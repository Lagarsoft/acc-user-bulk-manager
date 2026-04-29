import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listProjectUsers } from "@/app/lib/acc-admin";
import type { CsvOperationRow } from "@/app/lib/csv-parser";
import type {
  DryRunOperationResult,
  DryRunProjectResult,
  DryRunResponse,
} from "@/app/lib/dry-run";

/**
 * POST /api/dry-run
 *
 * Validates a list of CSV operations against the current Forma project state
 * without applying any changes.
 *
 * For each operation:
 *   - add:    warns if user already exists in the project
 *   - update: errors if user is NOT found in the project
 *   - remove: warns if user is NOT found in the project (no-op)
 *
 * Request body:
 *   { operations: CsvOperationRow[] }
 *
 * Response 200:
 *   DryRunResponse
 *
 * Response 400 / 500:
 *   { error: string }
 */

export async function POST(req: NextRequest) {
  let body: { operations?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.operations)) {
    return NextResponse.json(
      { error: "operations must be an array" },
      { status: 400 },
    );
  }

  const operations = body.operations as CsvOperationRow[];

  // Group operations by project so we only call listProjectUsers once per project.
  const byProject = new Map<string, CsvOperationRow[]>();
  for (const op of operations) {
    const list = byProject.get(op.projectId) ?? [];
    list.push(op);
    byProject.set(op.projectId, list);
  }

  const results: DryRunProjectResult[] = [];
  let totalValid = 0;
  let totalWarnings = 0;
  let totalErrors = 0;

  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  for (const [projectId, ops] of byProject) {
    // Fetch the project's current user list. If this fails we still validate
    // what we can (role values) but skip the existence checks.
    let existingEmails = new Set<string>();
    let userFetchFailed = false;
    try {
      const users = await listProjectUsers(projectId, token);
      existingEmails = new Set(users.map((u) => u.email.toLowerCase()));
    } catch (err) {
      console.error("[dry-run] listProjectUsers failed for projectId=%s", projectId, err);
      userFetchFailed = true;
    }

    const projectOps: DryRunOperationResult[] = ops.map((op) => {
      const email = op.email.toLowerCase();

      // Skip existence checks when the user fetch failed.
      if (userFetchFailed) {
        totalWarnings++;
        return {
          rowNumber: op.rowNumber,
          action: op.action,
          email: op.email,
          roles: op.roles,
          firstName: op.firstName,
          lastName: op.lastName,
          valid: true,
          issue: "Could not fetch project users — existence check skipped",
          severity: "warning" as const,
        };
      }

      const exists = existingEmails.has(email);

      if (op.action === "add" && exists) {
        totalWarnings++;
        return {
          rowNumber: op.rowNumber,
          action: op.action,
          email: op.email,
          roles: op.roles,
          firstName: op.firstName,
          lastName: op.lastName,
          valid: true,
          issue: "User already exists in this project — will update their role",
          severity: "warning" as const,
        };
      }

      if (op.action === "update" && !exists) {
        totalErrors++;
        return {
          rowNumber: op.rowNumber,
          action: op.action,
          email: op.email,
          roles: op.roles,
          firstName: op.firstName,
          lastName: op.lastName,
          valid: false,
          issue: "User not found in this project — cannot update",
          severity: "error" as const,
        };
      }

      if (op.action === "remove" && !exists) {
        totalWarnings++;
        return {
          rowNumber: op.rowNumber,
          action: op.action,
          email: op.email,
          roles: op.roles,
          firstName: op.firstName,
          lastName: op.lastName,
          valid: true,
          issue: "User not found in this project — remove will have no effect",
          severity: "warning" as const,
        };
      }

      totalValid++;
      return {
        rowNumber: op.rowNumber,
        action: op.action,
        email: op.email,
        roles: op.roles,
        firstName: op.firstName,
        lastName: op.lastName,
        valid: true,
      };
    });

    const projectName = ops[0]?.projectName;
    results.push({ projectId, ...(projectName ? { projectName } : {}), operations: projectOps });
  }

  const response: DryRunResponse = {
    results,
    summary: {
      total: operations.length,
      valid: totalValid,
      warnings: totalWarnings,
      errors: totalErrors,
    },
  };

  return NextResponse.json(response);
}

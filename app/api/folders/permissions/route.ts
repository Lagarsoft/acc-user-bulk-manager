import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listProjectUsers } from "@/app/lib/acc-admin";
import {
  batchGrantFolderPermissions,
  isPermissionLevel,
  PERMISSION_LEVELS,
  type FolderPermissionGrantResult,
  type PermissionLevel,
} from "@/app/lib/folder-permissions";

type SubjectType = "USER" | "COMPANY" | "ROLE";

/**
 * POST /api/folders/permissions
 *
 * Grants folder permissions for one project / folder.
 * Supports three subject types:
 *   - USER: email is resolved to a project-member UUID
 *   - COMPANY: subjectId is used directly as the company UUID
 *   - ROLE: subjectId is used directly as the project-role UUID
 *
 * Request body:
 *   {
 *     projectId: string,
 *     folderUrn: string,
 *     grants: Array<{
 *       subjectType?: "USER" | "COMPANY" | "ROLE",
 *       email?: string,         // required when subjectType === "USER"
 *       subjectId?: string,     // required when subjectType === "COMPANY" | "ROLE"
 *       permission: PermissionLevel
 *     }>
 *   }
 *
 * Response 200:
 *   { results: Array<{ subject: string; status: "granted"|"error"; message?: string }> }
 *   where `subject` is the email for USER grants and the subjectId for COMPANY/ROLE.
 */
export async function POST(req: NextRequest) {
  const userToken = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!userToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    projectId?: string;
    folderUrn?: string;
    grants?: Array<{
      subjectType?: string;
      email?: string;
      subjectId?: string;
      permission?: string;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectId, folderUrn, grants } = body;
  if (!projectId || !folderUrn || !Array.isArray(grants) || grants.length === 0) {
    return NextResponse.json(
      { error: "projectId, folderUrn, and a non-empty grants[] are required" },
      { status: 400 },
    );
  }

  try {
    // Only load project members once, and only if there are USER grants.
    const hasUserGrants = grants.some(
      (g) => !g.subjectType || g.subjectType.toUpperCase() === "USER",
    );
    const membersByEmail = new Map<string, { id: string; status: string; isProjectAdmin: boolean; isAccountAdmin: boolean }>();
    if (hasUserGrants) {
      const projectMembers = await listProjectUsers(projectId, userToken);
      for (const m of projectMembers) {
        if (m.email) membersByEmail.set(m.email.trim().toLowerCase(), m);
      }
    }

    type Resolved =
      | { kind: "error"; subject: string; message: string }
      | { kind: "skipped"; subject: string; message: string }
      | { kind: "ok"; subject: string; permission: PermissionLevel; subjectId: string; subjectType: SubjectType };

    const resolved: Resolved[] = grants.map((g): Resolved => {
      const rawType = (g.subjectType ?? "USER").toUpperCase() as SubjectType;
      const permission = (g.permission ?? "").toLowerCase();

      if (!isPermissionLevel(permission)) {
        const subject = g.email ?? g.subjectId ?? "";
        return { kind: "error", subject, message: `Invalid permission "${g.permission}"` };
      }

      if (rawType === "COMPANY") {
        const subjectId = (g.subjectId ?? "").trim();
        if (!subjectId) return { kind: "error", subject: "", message: "subjectId is required for COMPANY grants" };
        return { kind: "ok", subject: subjectId, permission: permission as PermissionLevel, subjectId, subjectType: "COMPANY" };
      }

      if (rawType === "ROLE") {
        const subjectId = (g.subjectId ?? "").trim();
        if (!subjectId) return { kind: "error", subject: "", message: "subjectId is required for ROLE grants" };
        return { kind: "ok", subject: subjectId, permission: permission as PermissionLevel, subjectId, subjectType: "ROLE" };
      }

      // USER type
      const email = (g.email ?? "").trim();
      if (!email) return { kind: "error", subject: email, message: "email is required for USER grants" };

      const member = membersByEmail.get(email.toLowerCase());
      if (!member) {
        return {
          kind: "error",
          subject: email,
          message: "User is not a member of this project — add them to the project first",
        };
      }

      if (member.status !== "active") {
        return {
          kind: "error",
          subject: email,
          message: `User invitation is ${member.status} — they must accept the project invite before folder permissions can be granted`,
        };
      }

      // Project/account admins already have full access via role inheritance.
      // Autodesk rejects explicit grants on them.
      if (member.isProjectAdmin || member.isAccountAdmin) {
        const which = member.isAccountAdmin ? "account admin" : "project admin";
        return {
          kind: "skipped",
          subject: email,
          message: `Already has full folder access as ${which} — no explicit grant needed`,
        };
      }

      return { kind: "ok", subject: email, permission: permission as PermissionLevel, subjectId: member.id, subjectType: "USER" };
    });

    // Group by permission level for efficient batch-create calls.
    const byLevel = new Map<PermissionLevel, Array<{ subject: string; subjectId: string; subjectType: SubjectType }>>();
    const results: Array<{ subject: string; status: "granted" | "error"; message?: string }> = [];

    for (const r of resolved) {
      if (r.kind === "error") {
        results.push({ subject: r.subject, status: "error", message: r.message });
        continue;
      }
      if (r.kind === "skipped") {
        results.push({ subject: r.subject, status: "granted", message: r.message });
        continue;
      }
      const level = r.permission;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)!.push({ subject: r.subject, subjectId: r.subjectId, subjectType: r.subjectType });
    }

    for (const [level, entries] of byLevel.entries()) {
      const actions = PERMISSION_LEVELS[level];
      const granted: FolderPermissionGrantResult[] = await batchGrantFolderPermissions(
        projectId,
        folderUrn,
        entries.map((e) => ({ subjectId: e.subjectId, subjectType: e.subjectType, actions })),
        userToken,
      );
      for (let i = 0; i < granted.length; i++) {
        const entry = entries[i];
        const g = granted[i];
        results.push({
          subject: entry.subject,
          status: g.status === "granted" ? "granted" : "error",
          message: g.message,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

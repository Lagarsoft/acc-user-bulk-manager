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

/**
 * POST /api/folders/permissions
 *
 * Grants folder permissions for one project / folder to a batch of users
 * identified by email. Each email must belong to a member of the target
 * project — we resolve against the project's user list (not the account
 * directory) because the Docs batch-create endpoint requires the subject
 * to already be a project member.
 *
 * Request body:
 *   {
 *     projectId: string,
 *     folderUrn: string,
 *     grants: Array<{ email: string; permission: PermissionLevel }>
 *   }
 *   (accountId is accepted for backward compatibility but ignored.)
 *
 * Response 200:
 *   { results: Array<{ email: string; status: "granted"|"error"; message?: string }> }
 */
export async function POST(req: NextRequest) {
  const userToken = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!userToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    projectId?: string;
    folderUrn?: string;
    grants?: Array<{ email?: string; permission?: string }>;
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
    // Load the project roster once and index by lowercased email.
    const projectMembers = await listProjectUsers(projectId, userToken);
    const membersByEmail = new Map<string, (typeof projectMembers)[number]>();
    for (const m of projectMembers) {
      if (m.email) membersByEmail.set(m.email.trim().toLowerCase(), m);
    }

    type Resolved =
      | { kind: "error"; email: string; message: string }
      | { kind: "skipped"; email: string; message: string }
      | { kind: "ok"; email: string; permission: PermissionLevel; subjectId: string };

    const resolved: Resolved[] = grants.map((g): Resolved => {
      const email = (g.email ?? "").trim();
      const permission = (g.permission ?? "").toLowerCase();

      if (!email) {
        return { kind: "error", email, message: "email is required" };
      }
      if (!isPermissionLevel(permission)) {
        return { kind: "error", email, message: `Invalid permission "${g.permission}"` };
      }

      const member = membersByEmail.get(email.toLowerCase());
      if (!member) {
        return {
          kind: "error",
          email,
          message: "User is not a member of this project — add them to the project first",
        };
      }

      // Project/account admins already have full access to every folder in the
      // project via role inheritance. Autodesk rejects explicit grants on them
      // (ERR_UNPROCESSABLE_ENTITY "is not allow to set actions"), so skip.
      if (member.isProjectAdmin || member.isAccountAdmin) {
        const which = member.isAccountAdmin ? "account admin" : "project admin";
        return {
          kind: "skipped",
          email,
          message: `Already has full folder access as ${which} — no explicit grant needed`,
        };
      }

      return { kind: "ok", email, permission: permission as PermissionLevel, subjectId: member.id };
    });

    // Group by permission level so the batch-create call can use the same actions array.
    const byLevel = new Map<PermissionLevel, Array<{ email: string; subjectId: string }>>();
    const results: Array<{ email: string; status: "granted" | "error"; message?: string }> = [];

    for (const r of resolved) {
      if (r.kind === "error") {
        results.push({ email: r.email, status: "error", message: r.message });
        continue;
      }
      if (r.kind === "skipped") {
        results.push({ email: r.email, status: "granted", message: r.message });
        continue;
      }
      const level = r.permission;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)!.push({ email: r.email, subjectId: r.subjectId });
    }

    for (const [level, entries] of byLevel.entries()) {
      const actions = PERMISSION_LEVELS[level];
      const granted: FolderPermissionGrantResult[] = await batchGrantFolderPermissions(
        projectId,
        folderUrn,
        entries.map((e) => ({ subjectId: e.subjectId, subjectType: "USER", actions })),
        userToken,
      );
      for (let i = 0; i < granted.length; i++) {
        const entry = entries[i];
        const g = granted[i];
        results.push({
          email: entry.email,
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

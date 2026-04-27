import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listProjectRoles } from "@/app/lib/acc-admin";

/**
 * GET /api/projects/:projectId/roles
 *
 * Returns the available roles for a project (id + name pairs).
 * Role IDs are project-specific UUIDs required by the ACC API.
 *
 * Response 200:
 *   { roles: { id: string; name: string }[] }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const roles = await listProjectRoles(projectId, token);
    return NextResponse.json({ roles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

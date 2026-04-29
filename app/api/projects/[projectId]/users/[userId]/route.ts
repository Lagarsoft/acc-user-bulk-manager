import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { updateProjectUser, removeProjectUser, type UpdateUserPayload } from "@/app/lib/acc-admin";

/**
 * PATCH /api/projects/:projectId/users/:userId
 *
 * Updates the roles of a user on a project.
 *
 * Request body:
 *   { roles: string[] }
 *   (legacy `role: string` is also accepted and normalised to `roles: [role]`)
 *
 * Response 200:
 *   { user: ProjectUser }
 *
 * Response 400:
 *   { error: string }
 *
 * Response 401:
 *   { error: "Not authenticated" }
 *
 * Response 500:
 *   { error: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; userId: string }> },
) {
  const { projectId, userId } = await params;

  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { roles?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let roles: string[];
  if (Array.isArray(body.roles) && body.roles.length > 0) {
    roles = body.roles as string[];
  } else if (typeof body.role === "string" && body.role) {
    roles = [body.role];
  } else {
    return NextResponse.json({ error: "Request body must include at least one role" }, { status: 400 });
  }

  try {
    const user = await updateProjectUser(projectId, userId, { roles: roles as UpdateUserPayload["roles"] }, token);
    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/:projectId/users/:userId
 *
 * Removes a user from a project.
 *
 * Response 204: (no body)
 *
 * Response 401:
 *   { error: "Not authenticated" }
 *
 * Response 500:
 *   { error: string }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; userId: string }> },
) {
  const { projectId, userId } = await params;

  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await removeProjectUser(projectId, userId, token);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

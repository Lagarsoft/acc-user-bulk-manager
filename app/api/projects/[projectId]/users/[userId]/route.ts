import { NextRequest, NextResponse } from "next/server";
import { getTwoLeggedToken } from "@/app/lib/aps-auth";
import { updateProjectUser, removeProjectUser } from "@/app/lib/acc-admin";

/**
 * PATCH /api/projects/:projectId/users/:userId
 *
 * Updates the role of a user on a project.
 *
 * Request body:
 *   { role: string }
 *
 * Response 200:
 *   { user: ProjectUser }
 *
 * Response 400:
 *   { error: string }
 *
 * Response 500:
 *   { error: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; userId: string }> },
) {
  const { projectId, userId } = await params;

  let body: { role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.role || typeof body.role !== "string") {
    return NextResponse.json({ error: "Request body must include a valid role" }, { status: 400 });
  }

  try {
    const token = await getTwoLeggedToken();
    const user = await updateProjectUser(projectId, userId, { role: body.role }, token);
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
 * Response 500:
 *   { error: string }
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; userId: string }> },
) {
  const { projectId, userId } = await params;

  try {
    const token = await getTwoLeggedToken();
    await removeProjectUser(projectId, userId, token);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

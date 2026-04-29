import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listProjectUsers, addProjectUsers, AddUsersPayload } from "@/app/lib/acc-admin";

/**
 * GET /api/projects/:projectId/users
 *
 * Lists all users in the given project with their roles.
 *
 * Response 200:
 *   { users: ProjectUser[] }
 *
 * Response 401:
 *   { error: "Not authenticated" }
 *
 * Response 500:
 *   { error: string }
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
    const users = await listProjectUsers(projectId, token);
    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/projects/:projectId/users
 *
 * Adds one or more users to the project.
 *
 * Request body:
 *   { users: AddUsersPayload[] }
 *   where AddUsersPayload = { email: string; roles: string[]; firstName?: string; lastName?: string }
 *   (legacy `role: string` is also accepted and normalised to `roles: [role]`)
 *
 * Response 201:
 *   { users: ProjectUser[] }
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
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { users?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.users) || body.users.length === 0) {
    return NextResponse.json(
      { error: "Request body must include a non-empty users array" },
      { status: 400 },
    );
  }

  const raw = body.users as Array<Record<string, unknown>>;
  const users: AddUsersPayload[] = [];

  for (const u of raw) {
    if (!u.email || typeof u.email !== "string") {
      return NextResponse.json({ error: "Each user must have a valid email" }, { status: 400 });
    }
    // Accept `roles: string[]` or legacy `role: string`
    let roles: string[];
    if (Array.isArray(u.roles) && u.roles.length > 0) {
      roles = u.roles as string[];
    } else if (typeof u.role === "string" && u.role) {
      roles = [u.role];
    } else {
      return NextResponse.json({ error: "Each user must have at least one role" }, { status: 400 });
    }
    users.push({
      email: u.email,
      roles: roles as AddUsersPayload["roles"],
      firstName: typeof u.firstName === "string" ? u.firstName : undefined,
      lastName: typeof u.lastName === "string" ? u.lastName : undefined,
    });
  }

  try {
    const created = await addProjectUsers(projectId, users, token);
    return NextResponse.json({ users: created }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

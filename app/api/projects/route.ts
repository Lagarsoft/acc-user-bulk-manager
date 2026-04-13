import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listProjects } from "@/app/lib/acc-admin";

/**
 * GET /api/projects?hubId=b.{accountId}
 *
 * Lists all projects for the given hub (ACC account), following
 * pagination automatically.  The `hubId` query parameter must use
 * the "b.{uuid}" format returned by GET /api/hubs.
 *
 * Response 200:
 *   { projects: Project[] }
 *
 * Response 400:
 *   { error: "hubId query parameter is required" }
 *
 * Response 500:
 *   { error: string }
 */
export async function GET(req: NextRequest) {
  const hubId = req.nextUrl.searchParams.get("hubId");

  if (!hubId) {
    return NextResponse.json(
      { error: "hubId query parameter is required" },
      { status: 400 },
    );
  }

  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const projects = await listProjects(hubId, token);
    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

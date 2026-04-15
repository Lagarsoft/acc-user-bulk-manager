import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listProjects, searchProjects } from "@/app/lib/acc-admin";

/**
 * GET /api/projects?hubId=b.{accountId}[&q={query}]
 *
 * Without `q`: lists all projects for the hub following pagination.
 * With `q`:    searches projects by name via the Forma Hub Admin API (up to 50 results).
 *              Requires at least 2 characters.
 *
 * The `hubId` parameter must use the "b.{uuid}" format from GET /api/hubs.
 */
export async function GET(req: NextRequest) {
  const hubId = req.nextUrl.searchParams.get("hubId");
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

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
    if (q.length >= 2) {
      const accountId = hubId.startsWith("b.") ? hubId.slice(2) : hubId;
      const projects = await searchProjects(accountId, q, token);
      return NextResponse.json({ projects });
    }

    const projects = await listProjects(hubId, token);
    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

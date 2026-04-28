import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN, getTwoLeggedToken } from "@/app/lib/aps-auth";
import { listProjectCompanies } from "@/app/lib/acc-admin";

/**
 * GET /api/projects/:projectId/companies?accountId=...
 *
 * Returns companies that are members of the given project.
 * Only project-member companies can receive folder-permission grants.
 * Uses a 2-legged token — the /hq/v1 endpoint rejects 3-legged tokens.
 *
 * Response 200:
 *   { companies: { id: string; name: string }[] }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  if (!req.cookies.get(COOKIE_ACCESS_TOKEN)?.value) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const token = await getTwoLeggedToken();
    const companies = await listProjectCompanies(accountId, projectId, token);
    return NextResponse.json({ companies });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN, getTwoLeggedToken } from "@/app/lib/aps-auth";
import { listAccountCompanies } from "@/app/lib/acc-admin";

/**
 * GET /api/companies?accountId=...
 *
 * Returns all companies in the given ACC account, sorted by name.
 * Uses a 2-legged token — the /hq/v1 companies endpoint rejects 3-legged tokens.
 *
 * Response 200:
 *   { companies: { id: string; name: string }[] }
 */
export async function GET(req: NextRequest) {
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
    const companies = await listAccountCompanies(accountId, token);
    return NextResponse.json({ companies });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

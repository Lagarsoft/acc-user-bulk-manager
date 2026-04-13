import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { searchAccountUsers } from "@/app/lib/acc-admin";

/**
 * GET /api/users?accountId={accountId}&q={query}
 *
 * Searches users in an ACC account by name or email (partial match).
 * Requires a valid 3-legged session and ACC Account Admin API provisioning.
 *
 * Response 200:
 *   { users: AccountUser[] }
 *
 * Response 400:
 *   { error: "accountId and q query parameters are required" }
 *
 * Response 401:
 *   { error: "Not authenticated" }
 *
 * Response 500:
 *   { error: string }
 */
export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");
  const query = req.nextUrl.searchParams.get("q");

  if (!accountId || !query) {
    return NextResponse.json(
      { error: "accountId and q query parameters are required" },
      { status: 400 },
    );
  }

  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const users = await searchAccountUsers(accountId, query, token);
    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

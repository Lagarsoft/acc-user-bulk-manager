import { NextRequest, NextResponse } from "next/server";
import { getTwoLeggedToken } from "@/app/lib/aps-auth";
import { searchAccountUsers } from "@/app/lib/acc-admin";

/**
 * GET /api/users?accountId={accountId}&q={query}
 *
 * Searches users in an ACC account by name or email (partial match).
 * Uses a 2-legged token — the Account Admin searchUsers endpoint does not
 * accept 3-legged tokens (returns 403 code 1003).
 *
 * Response 200:
 *   { users: AccountUser[] }
 *
 * Response 400:
 *   { error: "accountId and q query parameters are required" }
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

  try {
    const token = await getTwoLeggedToken();
    const users = await searchAccountUsers(accountId, query, token);
    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

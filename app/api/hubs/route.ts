import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listHubs } from "@/app/lib/acc-admin";

/**
 * GET /api/hubs
 *
 * Returns all ACC hubs (accounts) the signed-in user has access to.
 * Requires a valid 3-legged session (data:read scope).
 *
 * Response 200:
 *   { hubs: Hub[] }
 *
 * Response 401:
 *   { error: "Not authenticated" }
 *
 * Response 500:
 *   { error: string }
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const hubs = await listHubs(token);
    return NextResponse.json({ hubs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

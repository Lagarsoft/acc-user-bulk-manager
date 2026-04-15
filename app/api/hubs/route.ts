import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listHubs } from "@/app/lib/acc-admin";

/**
 * GET /api/hubs
 *
 * Returns all Forma hubs (accounts) the signed-in user has access to.
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
  console.log("[GET /api/hubs] request received");

  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    console.log("[GET /api/hubs] no token in cookie — returning 401");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  console.log("[GET /api/hubs] token present, calling listHubs");

  try {
    const hubs = await listHubs(token);
    console.log("[GET /api/hubs] success — returning %d hub(s): %o", hubs.length, hubs.map((h) => ({ id: h.id, name: h.name, region: h.region })));
    return NextResponse.json({ hubs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[GET /api/hubs] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

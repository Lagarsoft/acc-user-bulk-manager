import { NextResponse } from "next/server";
import { getTwoLeggedToken } from "@/app/lib/aps-auth";
import { listHubs } from "@/app/lib/acc-admin";

/**
 * GET /api/hubs
 *
 * Returns all ACC accounts (hubs) visible to the service account.
 *
 * Response 200:
 *   { hubs: Hub[] }
 *
 * Response 500:
 *   { error: string }
 */
export async function GET() {
  try {
    const token = await getTwoLeggedToken();
    const hubs = await listHubs(token);
    return NextResponse.json({ hubs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

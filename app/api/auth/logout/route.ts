import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN, COOKIE_REFRESH_TOKEN, COOKIE_EXPIRES_AT, COOKIE_USER_EMAIL } from "@/app/lib/aps-auth";
import { captureServerEvent } from "@/app/lib/posthog-server";

/**
 * POST /api/auth/logout
 *
 * Clears the 3-legged session cookies and redirects to home.
 */
export async function POST(req: NextRequest) {
  const email = req.cookies.get(COOKIE_USER_EMAIL)?.value;
  if (email) {
    await captureServerEvent(email, "logout");
  }

  const res = NextResponse.redirect(new URL("/", process.env.APS_CALLBACK_URL ?? "http://localhost:3000"));
  res.cookies.delete(COOKIE_ACCESS_TOKEN);
  res.cookies.delete(COOKIE_REFRESH_TOKEN);
  res.cookies.delete(COOKIE_EXPIRES_AT);
  res.cookies.delete(COOKIE_USER_EMAIL);
  return res;
}

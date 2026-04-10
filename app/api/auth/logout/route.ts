import { NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN, COOKIE_REFRESH_TOKEN, COOKIE_EXPIRES_AT } from "@/app/lib/aps-auth";

/**
 * POST /api/auth/logout
 *
 * Clears the 3-legged session cookies and redirects to home.
 */
export function POST() {
  const res = NextResponse.redirect(new URL("/", process.env.APS_CALLBACK_URL ?? "http://localhost:3000"));
  res.cookies.delete(COOKIE_ACCESS_TOKEN);
  res.cookies.delete(COOKIE_REFRESH_TOKEN);
  res.cookies.delete(COOKIE_EXPIRES_AT);
  return res;
}

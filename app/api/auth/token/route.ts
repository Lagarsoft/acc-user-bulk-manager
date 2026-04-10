import { NextRequest, NextResponse } from "next/server";
import {
  refreshAccessToken,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_EXPIRES_AT,
} from "@/app/lib/aps-auth";

/**
 * GET /api/auth/token
 *
 * Returns the current 3-legged session state. If the access token has
 * expired but a refresh token is present, it refreshes automatically.
 *
 * Response:
 *   200  { authenticated: true,  expiresAt: number }
 *   200  { authenticated: false }
 */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  const refreshToken = req.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  const expiresAt = Number(req.cookies.get(COOKIE_EXPIRES_AT)?.value ?? "0");

  if (!refreshToken) {
    return NextResponse.json({ authenticated: false });
  }

  // Token still valid.
  if (accessToken && expiresAt - 60_000 > Date.now()) {
    return NextResponse.json({ authenticated: true, expiresAt });
  }

  // Attempt refresh.
  const tokens = await refreshAccessToken(refreshToken);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  const res = NextResponse.json({ authenticated: true, expiresAt: tokens.expiresAt });
  res.cookies.set(COOKIE_ACCESS_TOKEN, tokens.accessToken, {
    ...cookieOptions,
    maxAge: Math.floor((tokens.expiresAt - Date.now()) / 1000),
  });
  res.cookies.set(COOKIE_REFRESH_TOKEN, tokens.refreshToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(COOKIE_EXPIRES_AT, String(tokens.expiresAt), {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}

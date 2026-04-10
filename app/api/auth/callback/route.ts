import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_EXPIRES_AT,
} from "@/app/lib/aps-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  const tokens = await exchangeCodeForTokens(code);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  res.cookies.set(COOKIE_ACCESS_TOKEN, tokens.accessToken, {
    ...cookieOptions,
    maxAge: Math.floor((tokens.expiresAt - Date.now()) / 1000),
  });
  res.cookies.set(COOKIE_REFRESH_TOKEN, tokens.refreshToken, {
    ...cookieOptions,
    // Keep refresh token alive for 30 days; APS will reject it if revoked.
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(COOKIE_EXPIRES_AT, String(tokens.expiresAt), {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}

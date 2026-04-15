import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_EXPIRES_AT,
  COOKIE_USER_EMAIL,
} from "@/app/lib/aps-auth";
import { captureServerEvent } from "@/app/lib/posthog-server";

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

  // Fetch Autodesk user profile to identify the user in PostHog.
  let userEmail = "unknown";
  try {
    const profileRes = await fetch("https://api.userprofile.autodesk.com/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (profileRes.ok) {
      const profile: { email?: string; name?: string } = await profileRes.json();
      if (profile.email) userEmail = profile.email;
    }
  } catch {
    // Non-fatal — tracking degrades gracefully.
  }

  await captureServerEvent(userEmail, "login_completed");

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

  // Readable (non-httpOnly) cookie so PostHogProvider can identify the user client-side.
  if (userEmail !== "unknown") {
    res.cookies.set(COOKIE_USER_EMAIL, userEmail, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}

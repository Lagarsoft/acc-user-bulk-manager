import { NextRequest, NextResponse } from "next/server";

/**
 * Route guard: redirect unauthenticated users to /login.
 *
 * A user is considered authenticated when the 3-legged APS access-token
 * cookie is present (set by GET /api/auth/callback after OAuth completes).
 *
 * Public paths that bypass the guard:
 *   /login          — the sign-in page itself
 *   /api/auth/*     — OAuth initiation, callback, and logout endpoints
 */

const SESSION_COOKIE = "aps_access_token";

const PUBLIC_PREFIXES = ["/login", "/api/auth/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    // API routes: return JSON so client-side fetches see a parseable error
    // instead of HTML from the /login page.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  // Run on every request except Next.js internals and static assets.
  // Excluding all of `_next/*` keeps HMR, RSC payloads, and static chunks
  // out of the auth guard.
  matcher: ["/((?!_next/|favicon.ico|.*\\.svg$).*)"],
};

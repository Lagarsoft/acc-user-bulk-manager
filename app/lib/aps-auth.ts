/**
 * APS (Autodesk Platform Services) OAuth helpers — built on @aps_sdk/authentication.
 *
 * 2-legged  – client_credentials, for server-side admin operations.
 *             Token is cached in module scope and refreshed automatically.
 *
 * 3-legged  – authorization_code, for user-delegated operations.
 *             Tokens are stored in HTTP-only cookies by the route handlers.
 */

import { AuthenticationClient, ResponseType, Scopes } from "@aps_sdk/authentication";

const authClient = new AuthenticationClient();

const TWO_LEGGED_SCOPES = [Scopes.AccountRead, Scopes.AccountWrite];
const THREE_LEGGED_SCOPES = [Scopes.DataRead, Scopes.DataWrite, Scopes.AccountRead];

// --------------------------------------------------------------------------
// 2-legged (client credentials)
// --------------------------------------------------------------------------

interface CachedToken {
  accessToken: string;
  expiresAt: number; // ms since epoch
}

let twoLeggedCache: CachedToken | null = null;

export async function getTwoLeggedToken(): Promise<string> {
  const now = Date.now();
  // Refresh 60 s before actual expiry to avoid clock-skew races.
  if (twoLeggedCache && twoLeggedCache.expiresAt - 60_000 > now) {
    return twoLeggedCache.accessToken;
  }

  const { APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;
  if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    throw new Error("APS_CLIENT_ID and APS_CLIENT_SECRET must be set");
  }

  console.log("[APS] getTwoLeggedToken → AuthenticationClient.getTwoLeggedToken");
  const token = await authClient.getTwoLeggedToken(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    TWO_LEGGED_SCOPES,
  );
  console.log("[APS] getTwoLeggedToken ✓ expires_in=%d", token.expires_in);

  twoLeggedCache = {
    accessToken: token.access_token!,
    expiresAt: now + (token.expires_in ?? 3600) * 1000,
  };
  return twoLeggedCache.accessToken;
}

// --------------------------------------------------------------------------
// 3-legged (authorization code)
// --------------------------------------------------------------------------

export function getAuthorizationUrl(state: string): string {
  const { APS_CLIENT_ID, APS_CALLBACK_URL } = process.env;
  if (!APS_CLIENT_ID || !APS_CALLBACK_URL) {
    throw new Error("APS_CLIENT_ID and APS_CALLBACK_URL must be set");
  }

  return authClient.authorize(
    APS_CLIENT_ID,
    ResponseType.Code,
    APS_CALLBACK_URL,
    THREE_LEGGED_SCOPES,
    { state },
  );
}

export interface ThreeLeggedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms since epoch
}

export async function exchangeCodeForTokens(code: string): Promise<ThreeLeggedTokens> {
  const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL } = process.env;
  if (!APS_CLIENT_ID || !APS_CLIENT_SECRET || !APS_CALLBACK_URL) {
    throw new Error("APS_CLIENT_ID, APS_CLIENT_SECRET, and APS_CALLBACK_URL must be set");
  }

  console.log("[APS] exchangeCodeForTokens → AuthenticationClient.getThreeLeggedToken");
  const token = await authClient.getThreeLeggedToken(
    APS_CLIENT_ID,
    code,
    APS_CALLBACK_URL,
    { clientSecret: APS_CLIENT_SECRET },
  );
  console.log("[APS] exchangeCodeForTokens ✓");

  return {
    accessToken: token.access_token!,
    refreshToken: token.refresh_token!,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<ThreeLeggedTokens> {
  const { APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;
  if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    throw new Error("APS_CLIENT_ID and APS_CLIENT_SECRET must be set");
  }

  console.log("[APS] refreshAccessToken → AuthenticationClient.refreshToken");
  const token = await authClient.refreshToken(
    refreshToken,
    APS_CLIENT_ID,
    { clientSecret: APS_CLIENT_SECRET, scopes: THREE_LEGGED_SCOPES },
  );
  console.log("[APS] refreshAccessToken ✓");

  return {
    accessToken: token.access_token!,
    refreshToken: token.refresh_token!,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
}

// --------------------------------------------------------------------------
// Cookie names (shared constants used by route handlers)
// --------------------------------------------------------------------------

export const COOKIE_ACCESS_TOKEN = "aps_access_token";
export const COOKIE_REFRESH_TOKEN = "aps_refresh_token";
export const COOKIE_EXPIRES_AT = "aps_expires_at";

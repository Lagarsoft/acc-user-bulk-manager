/**
 * APS (Autodesk Platform Services) OAuth helpers.
 *
 * 2-legged  – client_credentials, for server-side admin operations.
 *             Token is cached in module scope and refreshed automatically.
 *
 * 3-legged  – authorization_code, for user-delegated operations.
 *             Tokens are stored in HTTP-only cookies by the route handlers.
 */

const APS_TOKEN_URL = "https://developer.api.autodesk.com/authentication/v2/token";
const APS_AUTHORIZE_URL = "https://developer.api.autodesk.com/authentication/v2/authorize";

// Scopes required by the ACC Account Admin and Project Admin APIs.
const TWO_LEGGED_SCOPES = "account:read account:write";
const THREE_LEGGED_SCOPES = "data:read data:write account:read";

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

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: TWO_LEGGED_SCOPES,
  });

  const credentials = Buffer.from(`${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`).toString("base64");

  const res = await fetch(APS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APS 2-legged token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  twoLeggedCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
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

  const params = new URLSearchParams({
    response_type: "code",
    client_id: APS_CLIENT_ID,
    redirect_uri: APS_CALLBACK_URL,
    scope: THREE_LEGGED_SCOPES,
    state,
  });

  return `${APS_AUTHORIZE_URL}?${params.toString()}`;
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

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: APS_CALLBACK_URL,
  });

  const credentials = Buffer.from(`${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`).toString("base64");

  const res = await fetch(APS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APS code exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<ThreeLeggedTokens> {
  const { APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;
  if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    throw new Error("APS_CLIENT_ID and APS_CLIENT_SECRET must be set");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: THREE_LEGGED_SCOPES,
  });

  const credentials = Buffer.from(`${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`).toString("base64");

  const res = await fetch(APS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APS token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// --------------------------------------------------------------------------
// Cookie names (shared constants used by route handlers)
// --------------------------------------------------------------------------

export const COOKIE_ACCESS_TOKEN = "aps_access_token";
export const COOKIE_REFRESH_TOKEN = "aps_refresh_token";
export const COOKIE_EXPIRES_AT = "aps_expires_at";

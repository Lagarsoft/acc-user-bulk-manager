/**
 * Direct APS API client for E2E test setup and verification.
 * All functions use a 2-legged token (account:read, account:write) so they
 * work without a browser session and can be used in globalSetup/Teardown too.
 */

import { AuthenticationClient, Scopes } from "@aps_sdk/authentication";
import { AdminClient, Platform } from "@aps_sdk/construction-account-admin";

const authClient = new AuthenticationClient();
const adminClient = new AdminClient();

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

let _tokenCache: { value: string; expiresAt: number } | null = null;

export async function getTwoLeggedToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache && _tokenCache.expiresAt - 30_000 > now) return _tokenCache.value;

  const { APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;
  if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    throw new Error("APS_CLIENT_ID and APS_CLIENT_SECRET must be in the environment");
  }

  const token = await authClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [
    Scopes.AccountRead,
    Scopes.AccountWrite,
    Scopes.DataRead,
    Scopes.DataWrite,
  ]);

  _tokenCache = {
    value: token.access_token!,
    expiresAt: now + (token.expires_in ?? 3600) * 1000,
  };
  return _tokenCache.value;
}

// ---------------------------------------------------------------------------
// Account discovery
// ---------------------------------------------------------------------------

/**
 * Returns the account ID.
 * Reads APS_ACCOUNT_ID from env first (preferred).
 * If absent, tries several ACC/BIM360 discovery endpoints in order.
 *
 * To find your account ID manually:
 *   1. Log into acc.autodesk.com → Account Admin
 *   2. Copy the UUID from the URL: .../account/<ACCOUNT_ID>/...
 *   3. Add APS_ACCOUNT_ID=<uuid> to .env.local
 */
export async function discoverAccountId(token: string): Promise<string> {
  if (process.env.APS_ACCOUNT_ID) return process.env.APS_ACCOUNT_ID;

  const candidates = [
    // ACC Construction Admin API (v1)
    "https://developer.api.autodesk.com/construction/admin/v1/accounts",
    // BIM360 Admin API (v2)
    "https://developer.api.autodesk.com/hq/v2/accounts",
    // BIM360 Admin API (v1)
    "https://developer.api.autodesk.com/hq/v1/accounts?limit=1",
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) continue;
      const data = await res.json() as
        | Array<{ id?: string; account_id?: string }>
        | { results?: Array<{ id?: string }> }
        | { data?: Array<{ id?: string }> };

      // Handle different response shapes
      const list = Array.isArray(data)
        ? data
        : "results" in data
        ? (data.results ?? [])
        : "data" in data
        ? (data.data ?? [])
        : [];

      const id = list[0]?.id ?? (list[0] as Record<string, unknown>)?.account_id;
      if (typeof id === "string" && id) {
        console.log(`[discoverAccountId] found via ${url}`);
        return id;
      }
    } catch {
      // try next
    }
  }

  throw new Error(
    [
      "Could not auto-discover account ID. Add it to .env.local:",
      "  APS_ACCOUNT_ID=<your-uuid>",
      "",
      "Find it at: acc.autodesk.com → Account Admin → copy UUID from the URL",
    ].join("\n")
  );
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface TestProject {
  id: string;
  name: string;
  accountId: string;
  hubId: string;
}

/**
 * Creates a new ACC project for testing via the AdminClient SDK.
 * Returns the bare project ID (without "b." prefix).
 *
 * Requires the APS app to be provisioned in the ACC account (Account Admin →
 * Apps & Integrations). If the app lacks permission, add APS_TEST_PROJECT_ID
 * and APS_TEST_PROJECT_NAME to .env.local and the global-setup will skip
 * project creation entirely.
 */
export async function createTestProject(
  accountId: string,
  name: string,
  token: string
): Promise<string> {
  const project = await adminClient.createProject(
    accountId,
    {
      name,
      type: "Building Construction",
      platform: Platform.Acc,
      timezone: "America/New_York",
    },
    { accessToken: token }
  );

  if (!project.id) throw new Error(`createTestProject: no id in response`);
  return project.id;
}

/**
 * Archives a project (soft-delete). Used in teardown.
 * Tries the ACC Admin API first; falls back to the BIM360 endpoint.
 */
export async function archiveProject(
  accountId: string,
  projectId: string,
  token: string
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Try ACC Admin API first
  const accUrl = `https://developer.api.autodesk.com/construction/admin/v1/accounts/${accountId}/projects/${projectId}`;
  const accRes = await fetch(accUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "archived" }),
  });
  if (accRes.ok) return;

  // Fall back to BIM360
  const bimUrl = `https://developer.api.autodesk.com/hq/v1/accounts/${accountId}/projects/${projectId}`;
  const bimRes = await fetch(bimUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "archived" }),
  });
  if (!bimRes.ok) {
    const body = await bimRes.text();
    console.warn(`archiveProject HTTP ${bimRes.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Project users
// ---------------------------------------------------------------------------

/**
 * Updates a project user's role back to a given role name.
 * Looks the user up by email, resolves the role name to a UUID via the
 * industry_roles endpoint, and calls updateProjectUser.
 * Used by test afterAll hooks to revert changes.
 */
export async function revertProjectUserRole(
  projectId: string,
  email: string,
  roleName: string,
  token: string
): Promise<void> {
  // Find user ID by email
  const page = await adminClient.getProjectUsers(projectId, { limit: 100, accessToken: token });
  const user = (page.results ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
  );
  if (!user?.id) {
    console.warn(`[revertProjectUserRole] user ${email} not found in project ${projectId}`);
    return;
  }

  // Resolve role name → UUID.
  // Try industry_roles endpoint with several URL variants; if none work, look
  // for another project member already holding the target role and copy their UUID.
  let roleId: string | null = null;

  const normalised = roleName.toLowerCase().replace(/[\s-]+/g, "_");
  const nameMatch = (name: string) => {
    const n = name.toLowerCase();
    return n === roleName.toLowerCase() || n.replace(/[\s-]+/g, "_") === normalised;
  };

  const roleUrls = [
    `https://developer.api.autodesk.com/hq/v2/projects/b.${projectId}/industry_roles`,
    `https://developer.api.autodesk.com/hq/v2/projects/${projectId}/industry_roles`,
    `https://developer.api.autodesk.com/hq/v1/projects/${projectId}/industry_roles`,
  ];
  for (const url of roleUrls) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = (await res.json()) as { roles?: Array<{ id: string; name: string }> };
        const match = (data.roles ?? []).find((r) => nameMatch(r.name));
        if (match?.id) { roleId = match.id; break; }
      }
    } catch { /* try next */ }
  }

  // Fallback: find another project member already holding the role and reuse their roleId UUID
  if (!roleId) {
    const exemplar = (page.results ?? []).find(
      (u) => (u.email ?? "").toLowerCase() !== email.toLowerCase() &&
              u.roleIds?.[0] &&
              nameMatch(u.roles?.[0]?.name ?? "")
    );
    if (exemplar?.roleIds?.[0]) roleId = exemplar.roleIds[0];
  }

  if (!roleId) {
    console.warn(`[revertProjectUserRole] could not resolve role "${roleName}" to a UUID — skipping revert`);
    return;
  }

  await adminClient.updateProjectUser(
    projectId,
    user.id,
    { roleIds: [roleId] },
    { accessToken: token }
  );
  console.log(`[revertProjectUserRole] ${email} reverted to "${roleName}" (roleId=${roleId})`);
}

export interface ApiProjectUser {
  id: string;
  email: string;
  status: string;
  role: string;
}

/**
 * Lists project members. Polls until at least `minCount` users appear or the
 * deadline is reached — the importProjectUsers endpoint is async.
 */
export async function waitForProjectUsers(
  projectId: string,
  emails: string[],
  token: string,
  timeoutMs = 60_000
): Promise<ApiProjectUser[]> {
  const deadline = Date.now() + timeoutMs;
  const normalised = emails.map((e) => e.toLowerCase());

  while (Date.now() < deadline) {
    const page = await adminClient.getProjectUsers(projectId, {
      limit: 100,
      accessToken: token,
    });
    const users = (page.results ?? []).map((u) => ({
      id: u.id ?? "",
      email: u.email ?? "",
      status: u.status ?? "",
      role: (u.roles?.[0]?.name ?? "").toLowerCase() || (u.roleIds?.[0] ?? ""),
    }));

    const found = normalised.every((email) =>
      users.some((u) => u.email.toLowerCase() === email)
    );
    if (found) return users;

    await new Promise((r) => setTimeout(r, 3_000));
  }

  throw new Error(
    `Timed out waiting for users [${emails.join(", ")}] to appear in project ${projectId}`
  );
}

export async function listProjectUsers(
  projectId: string,
  token: string
): Promise<ApiProjectUser[]> {
  const page = await adminClient.getProjectUsers(projectId, {
    limit: 100,
    accessToken: token,
  });
  return (page.results ?? []).map((u) => ({
    id: u.id ?? "",
    email: u.email ?? "",
    status: u.status ?? "",
    role: (u.roles?.[0]?.name ?? "").toLowerCase() || (u.roleIds?.[0] ?? ""),
  }));
}

/**
 * Polls project users until the given email's role matches `rolePattern`,
 * or the timeout is reached.
 */
export async function waitForProjectUserRole(
  projectId: string,
  email: string,
  rolePattern: RegExp,
  token: string,
  timeoutMs = 30_000
): Promise<ApiProjectUser> {
  const deadline = Date.now() + timeoutMs;
  let lastRole: string | undefined;
  while (Date.now() < deadline) {
    const users = await listProjectUsers(projectId, token);
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user && rolePattern.test(user.role)) return user;
    lastRole = user?.role;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(
    `Timed out waiting for ${email} to have role matching ${rolePattern}. Last observed role: "${lastRole ?? "not found"}"`
  );
}

// ---------------------------------------------------------------------------
// Account users
// ---------------------------------------------------------------------------

export interface ApiAccountUser {
  id: string;
  email: string;
  status: string;
}

/**
 * Searches for an account user by exact email match.
 */
export async function findAccountUser(
  accountId: string,
  email: string,
  token: string
): Promise<ApiAccountUser | null> {
  try {
    const results = await adminClient.searchUsers(accountId, {
      email,
      partial: false,
      limit: 1,
      accessToken: token,
    });
    const first = results[0];
    if (!first) return null;
    return { id: first.id ?? "", email: first.email ?? "", status: first.status ?? "" };
  } catch {
    return null;
  }
}

/**
 * Polls until the account user with the given email appears (status "active" or "pending").
 */
export async function waitForAccountUser(
  accountId: string,
  email: string,
  token: string,
  timeoutMs = 30_000
): Promise<ApiAccountUser> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const user = await findAccountUser(accountId, email, token);
    if (user) return user;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(`Timed out waiting for account user ${email}`);
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export interface ApiCompany {
  id: string;
  name: string;
}

export async function findCompanyByName(
  accountId: string,
  name: string,
  token: string
): Promise<ApiCompany | null> {
  const url = `https://developer.api.autodesk.com/hq/v1/accounts/${accountId}/companies?limit=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const companies = (await res.json()) as Array<{ id?: string; name?: string }>;
  const match = companies.find((c) => c.name?.toLowerCase() === name.toLowerCase());
  return match?.id && match?.name ? { id: match.id, name: match.name } : null;
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export interface ApiFolderPermission {
  subjectType: string;
  subjectId: string;
  actions: string[];
}

/**
 * Lists folder-level permissions for a given folder URN.
 * Requires a token with data:read scope.
 */
export async function listFolderPermissions(
  projectId: string,
  folderUrn: string,
  token: string
): Promise<ApiFolderPermission[]> {
  const proj = projectId.startsWith("b.") ? projectId : `b.${projectId}`;
  const url = `https://developer.api.autodesk.com/data/v1/projects/${proj}/folders/${encodeURIComponent(folderUrn)}/permissions`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ type?: string; id?: string; attributes?: { actions?: string[] } }> };
  return (data.data ?? []).map((item) => ({
    subjectType: item.type ?? "",
    subjectId: item.id ?? "",
    actions: item.attributes?.actions ?? [],
  }));
}

/**
 * Fetches top-level folders for a project.
 * Returns an array of { id, name } sorted by name.
 */
export async function listTopFolders(
  hubId: string,
  projectId: string,
  token: string
): Promise<Array<{ id: string; name: string }>> {
  const hub = hubId.startsWith("b.") ? hubId : `b.${hubId}`;
  const proj = projectId.startsWith("b.") ? projectId : `b.${projectId}`;
  const url = `https://developer.api.autodesk.com/project/v1/hubs/${hub}/projects/${proj}/topFolders`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ id?: string; attributes?: { name?: string } }> };
  return (data.data ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.attributes?.name ?? f.id ?? "",
  }));
}

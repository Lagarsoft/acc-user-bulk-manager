/**
 * ACC Account Admin API client.
 *
 * Covers:
 *   - GET /hq/v1/accounts                                               → listHubs()
 *   - GET /construction/admin/v1/accounts/:accountId/projects           → listProjects()
 *
 * All functions accept a 2-legged access token (account:read scope).
 * Rate-limit responses (429) are retried with exponential back-off.
 */

const APS_BASE = "https://developer.api.autodesk.com";

// --------------------------------------------------------------------------
// Internal models
// --------------------------------------------------------------------------

export interface Hub {
  id: string;        // "b.{accountId}" — matches Data Management API hub IDs
  accountId: string; // raw UUID used by the Admin API
  name: string;
  region: string;
}

export interface Project {
  id: string;
  hubId: string;     // "b.{accountId}"
  accountId: string;
  name: string;
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  updatedAt: string;
}

// --------------------------------------------------------------------------
// Raw shapes returned by the Autodesk APIs
// --------------------------------------------------------------------------

interface RawAccount {
  id: string;
  name: string;
  region?: string;
}

interface RawProject {
  id: string;
  name: string;
  status: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

interface ProjectsPage {
  results: RawProject[];
  pagination: {
    limit: number;
    offset: number;
    totalResults: number;
    nextUrl?: string;
  };
}

// --------------------------------------------------------------------------
// HTTP helper with rate-limit retry
// --------------------------------------------------------------------------

async function apsFetch(url: string, token: string, retries = 4): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status !== 429) return res;

    const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
    const backoff = Math.min(retryAfter * 1000, 2 ** attempt * 1000);
    await new Promise((r) => setTimeout(r, backoff));
  }

  // Final attempt — return whatever we get.
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

async function requireOk(res: Response, context: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ACC Admin API error in ${context} (${res.status}): ${body}`);
  }
}

// --------------------------------------------------------------------------
// Hubs
// --------------------------------------------------------------------------

/**
 * Lists all ACC accounts visible to the service account.
 * Uses the BIM 360 HQ Account Admin API, which works with a 2-legged
 * token that has the `account:read` scope.
 */
export async function listHubs(token: string): Promise<Hub[]> {
  const url = `${APS_BASE}/hq/v1/accounts`;
  const res = await apsFetch(url, token);
  await requireOk(res, "listHubs");

  const accounts: RawAccount[] = await res.json();

  return accounts.map((a) => ({
    id: `b.${a.id}`,
    accountId: a.id,
    name: a.name,
    region: a.region ?? "US",
  }));
}

// --------------------------------------------------------------------------
// Projects
// --------------------------------------------------------------------------

const PROJECTS_PAGE_LIMIT = 100;

/**
 * Lists all projects for the given account, following pagination automatically.
 * Uses the ACC Account Admin API with a 2-legged token (`account:read` scope).
 *
 * @param accountId - Raw UUID (without the "b." prefix).
 */
export async function listProjects(accountId: string, token: string): Promise<Project[]> {
  const hubId = `b.${accountId}`;
  const allProjects: Project[] = [];
  let offset = 0;

  while (true) {
    const url =
      `${APS_BASE}/construction/admin/v1/accounts/${accountId}/projects` +
      `?limit=${PROJECTS_PAGE_LIMIT}&offset=${offset}`;

    const res = await apsFetch(url, token);
    await requireOk(res, `listProjects(${accountId}, offset=${offset})`);

    const page: ProjectsPage = await res.json();

    for (const p of page.results) {
      allProjects.push(normalizeProject(p, hubId, accountId));
    }

    const fetched = offset + page.results.length;
    if (fetched >= page.pagination.totalResults || page.results.length === 0) break;

    offset = fetched;
  }

  return allProjects;
}

function normalizeProject(raw: RawProject, hubId: string, accountId: string): Project {
  const status = (raw.status ?? "active").toLowerCase();

  return {
    id: raw.id,
    hubId,
    accountId,
    name: raw.name,
    status: status === "active" || status === "inactive" || status === "suspended"
      ? (status as Project["status"])
      : "active",
    createdAt: raw.created_at ?? raw.createdAt ?? "",
    updatedAt: raw.updated_at ?? raw.updatedAt ?? "",
  };
}

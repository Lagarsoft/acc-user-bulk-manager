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

// --------------------------------------------------------------------------
// Project users — internal models
// --------------------------------------------------------------------------

/**
 * ACC role identifiers returned by the Project Admin API.
 * Only the values the API actually sends are listed here.
 */
export type AccRole =
  | "admin"
  | "member"
  | "project_admin"
  | "project_manager"
  | "gc_foreman"
  | "gc_manager"
  | "owner"
  | "executive"
  | "editor"
  | "viewer"
  | (string & {}); // allow unknown future values

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  member: "Member",
  project_admin: "Project Admin",
  project_manager: "Project Manager",
  gc_foreman: "GC Foreman",
  gc_manager: "GC Manager",
  owner: "Owner",
  executive: "Executive",
  editor: "Editor",
  viewer: "Viewer",
};

/** Maps an ACC role identifier to a human-readable label. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role.toLowerCase()] ?? role;
}

export interface ProjectUser {
  id: string;
  projectId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AccRole;
  roleLabel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddUsersPayload {
  email: string;
  role: AccRole;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserPayload {
  role: AccRole;
}

// --------------------------------------------------------------------------
// Raw shapes from the ACC Project Admin API
// --------------------------------------------------------------------------

interface RawProjectUser {
  id: string;
  email: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  role: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

interface ProjectUsersPage {
  results: RawProjectUser[];
  pagination: {
    limit: number;
    offset: number;
    totalResults: number;
    nextUrl?: string;
  };
}

// --------------------------------------------------------------------------
// Project user operations
// --------------------------------------------------------------------------

const USERS_PAGE_LIMIT = 100;

/**
 * Lists all users in a project, following pagination automatically.
 * Uses ACC Project Admin API with a 2-legged token (`account:read`).
 */
export async function listProjectUsers(projectId: string, token: string): Promise<ProjectUser[]> {
  const allUsers: ProjectUser[] = [];
  let offset = 0;

  while (true) {
    const url =
      `${APS_BASE}/construction/admin/v1/projects/${projectId}/users` +
      `?limit=${USERS_PAGE_LIMIT}&offset=${offset}`;

    const res = await apsFetch(url, token);
    await requireOk(res, `listProjectUsers(${projectId}, offset=${offset})`);

    const page: ProjectUsersPage = await res.json();

    for (const u of page.results) {
      allUsers.push(normalizeUser(u, projectId));
    }

    const fetched = offset + page.results.length;
    if (fetched >= page.pagination.totalResults || page.results.length === 0) break;

    offset = fetched;
  }

  return allUsers;
}

/**
 * Adds one or more users to a project.
 * The ACC API accepts a batch; returns the created user records.
 */
export async function addProjectUsers(
  projectId: string,
  users: AddUsersPayload[],
  token: string,
): Promise<ProjectUser[]> {
  const url = `${APS_BASE}/construction/admin/v1/projects/${projectId}/users:import`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(users.map((u) => ({
      email: u.email,
      role: u.role,
      first_name: u.firstName,
      last_name: u.lastName,
    }))),
  });

  await requireOk(res, `addProjectUsers(${projectId})`);

  const data: { results?: RawProjectUser[] } = await res.json();
  return (data.results ?? []).map((u) => normalizeUser(u, projectId));
}

/**
 * Updates a user's role on a project.
 */
export async function updateProjectUser(
  projectId: string,
  userId: string,
  payload: UpdateUserPayload,
  token: string,
): Promise<ProjectUser> {
  const url = `${APS_BASE}/construction/admin/v1/projects/${projectId}/users/${userId}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: payload.role }),
  });

  await requireOk(res, `updateProjectUser(${projectId}, ${userId})`);

  const raw: RawProjectUser = await res.json();
  return normalizeUser(raw, projectId);
}

/**
 * Removes a user from a project.
 */
export async function removeProjectUser(
  projectId: string,
  userId: string,
  token: string,
): Promise<void> {
  const url = `${APS_BASE}/construction/admin/v1/projects/${projectId}/users/${userId}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  await requireOk(res, `removeProjectUser(${projectId}, ${userId})`);
}

function normalizeUser(raw: RawProjectUser, projectId: string): ProjectUser {
  const role = raw.role ?? "";
  return {
    id: raw.id,
    projectId,
    email: raw.email,
    firstName: raw.first_name ?? raw.firstName ?? "",
    lastName: raw.last_name ?? raw.lastName ?? "",
    role,
    roleLabel: roleLabel(role),
    status: raw.status ?? "active",
    createdAt: raw.created_at ?? raw.createdAt ?? "",
    updatedAt: raw.updated_at ?? raw.updatedAt ?? "",
  };
}

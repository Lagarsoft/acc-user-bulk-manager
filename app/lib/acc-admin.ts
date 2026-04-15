/**
 * Forma Hub Admin API client — built on @aps_sdk/construction-account-admin.
 *
 * Covers:
 *   - listHubs()                                                → reads APS_ACCOUNT_ID from env
 *   - listProjects(accountId)                                   → AdminClient.getProjects()
 *   - listProjectUsers(projectId)                               → AdminClient.getProjectUsers()
 *   - addProjectUsers(projectId, users)                         → AdminClient.importProjectUsers()
 *   - updateProjectUser(projectId, userId, payload)             → AdminClient.updateProjectUser()
 *   - removeProjectUser(projectId, userId)                      → AdminClient.removeProjectUser()
 *
 * All functions accept a 2-legged access token (account:read / account:write scope).
 */

import { AdminClient, FilterTextMatch, ProjectUser as SdkProjectUser, ProjectUserResponse } from "@aps_sdk/construction-account-admin";
import { DataManagementClient } from "@aps_sdk/data-management";

const adminClient = new AdminClient();
const dmClient = new DataManagementClient();

const PAGE_LIMIT = 100;

// --------------------------------------------------------------------------
// Internal models
// --------------------------------------------------------------------------

export interface Hub {
  id: string;        // "b.{accountId}" — matches Data Management API hub IDs
  accountId: string; // raw UUID used by the Admin API
  name: string;
  region: string;
  /** APS extension type, e.g. "hubs:autodesk.bim360:Hub" for Forma/BIM360 hubs */
  type?: string;
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
  | (string & {});

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

export interface AccountUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  status: string;
  companyName: string;
}

// --------------------------------------------------------------------------
// Hubs
// --------------------------------------------------------------------------

/**
 * Lists all hubs the signed-in user has access to.
 * Uses the Data Management API with a 3-legged token (data:read scope).
 */
export async function listHubs(token: string): Promise<Hub[]> {
  console.log("[APS] listHubs → DataManagement.getHubs");
  const response = await dmClient.getHubs({ accessToken: token });
  console.log("[APS] listHubs ✓ got", response.data?.length ?? 0, "hubs");

  return (response.data ?? []).map((hub) => {
    const rawId = hub.id ?? "";
    const accountId = rawId.startsWith("b.") ? rawId.slice(2) : rawId;
    return {
      id: rawId,
      accountId,
      name: hub.attributes?.name ?? accountId,
      region: hub.attributes?.region ?? "US",
      type: hub.attributes?.extension?.type,
    };
  });
}

// --------------------------------------------------------------------------
// Projects
// --------------------------------------------------------------------------

/**
 * Lists all projects for the given hub using the Data Management API.
 * Accepts the full hubId with "b." prefix (e.g. "b.{accountId}").
 * Works with a 3-legged token on any hub type including ADN.
 */
export async function listProjects(hubId: string, token: string): Promise<Project[]> {
  console.log("[APS] listProjects → DataManagement.getHubProjects hubId=%s", hubId);
  const accountId = hubId.startsWith("b.") ? hubId.slice(2) : hubId;
  const allProjects: Project[] = [];
  let pageNumber = 0;

  while (true) {
    console.log("[APS] listProjects page pageNumber=%d", pageNumber);
    const page = await dmClient.getHubProjects(hubId, {
      pageNumber,
      pageLimit: PAGE_LIMIT,
      accessToken: token,
    });

    for (const p of page.data ?? []) {
      // DM API returns IDs with "b." prefix — strip it for Forma Hub Admin API calls.
      const rawId = p.id.startsWith("b.") ? p.id.slice(2) : p.id;
      allProjects.push({
        id: rawId,
        hubId,
        accountId,
        name: p.attributes?.name ?? rawId,
        status: "active",
        createdAt: "",
        updatedAt: "",
      });
    }

    console.log("[APS] listProjects page got %d projects", page.data?.length ?? 0);
    if (!page.links?.next?.href) break;
    pageNumber++;
  }

  console.log("[APS] listProjects ✓ total=%d", allProjects.length);
  return allProjects;
}

/**
 * Searches projects by name using the Forma Hub Admin API.
 * Returns up to 50 results. Requires a 3-legged token with data:read scope.
 */
export async function searchProjects(accountId: string, query: string, token: string): Promise<Project[]> {
  console.log("[APS] searchProjects accountId=%s query=%s", accountId, query);
  const result = await adminClient.getProjects(accountId, {
    filterName: query,
    filterTextMatch: FilterTextMatch.Contains,
    limit: 50,
    accessToken: token,
  });
  const hubId = `b.${accountId}`;
  return (result.results ?? []).map((p) => ({
    id: p.id ?? "",
    hubId,
    accountId,
    name: p.name ?? "",
    status: (p.status as "active" | "inactive" | "suspended") ?? "active",
    createdAt: p.createdAt ?? "",
    updatedAt: p.updatedAt ?? "",
  }));
}

// --------------------------------------------------------------------------
// Project users
// --------------------------------------------------------------------------

/**
 * Lists all users in a project, following pagination automatically.
 */
export async function listProjectUsers(projectId: string, token: string): Promise<ProjectUser[]> {
  console.log("[APS] listProjectUsers → AdminClient.getProjectUsers projectId=%s", projectId);
  const allUsers: ProjectUser[] = [];
  let offset = 0;

  while (true) {
    console.log("[APS] listProjectUsers page offset=%d", offset);
    const page = await adminClient.getProjectUsers(projectId, {
      limit: PAGE_LIMIT,
      offset,
      accessToken: token,
    });

    for (const u of page.results ?? []) {
      allUsers.push(normalizeUser(u as SdkProjectUser, projectId));
    }

    const fetched = offset + (page.results?.length ?? 0);
    console.log("[APS] listProjectUsers page got %d/%d users", fetched, page.pagination?.totalResults ?? "?");
    if (fetched >= (page.pagination?.totalResults ?? 0) || !page.results?.length) break;
    offset = fetched;
  }

  console.log("[APS] listProjectUsers ✓ total=%d", allUsers.length);
  return allUsers;
}

/**
 * Adds one or more users to a project using the bulk import endpoint.
 * The Forma import API is asynchronous — it returns a jobId, not user records.
 * This function submits the import and returns an empty array; callers should
 * re-fetch users after a short delay to confirm the operation completed.
 */
export async function addProjectUsers(
  projectId: string,
  users: AddUsersPayload[],
  token: string,
): Promise<ProjectUser[]> {
  console.log("[APS] addProjectUsers → AdminClient.importProjectUsers projectId=%s count=%d", projectId, users.length);
  await adminClient.importProjectUsers(
    projectId,
    {
      users: users.map((u) => ({
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        products: [],
      })),
    },
    { accessToken: token },
  );

  console.log("[APS] addProjectUsers ✓ import submitted");
  return [];
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
  console.log("[APS] updateProjectUser → AdminClient.updateProjectUser projectId=%s userId=%s role=%s", projectId, userId, payload.role);
  const response = await adminClient.updateProjectUser(
    projectId,
    userId,
    { roleIds: [payload.role] },
    { accessToken: token },
  );

  console.log("[APS] updateProjectUser ✓");
  return normalizeUserResponse(response, projectId);
}

/**
 * Removes a user from a project.
 */
export async function removeProjectUser(
  projectId: string,
  userId: string,
  token: string,
): Promise<void> {
  console.log("[APS] removeProjectUser → AdminClient.removeProjectUser projectId=%s userId=%s", projectId, userId);
  await adminClient.removeProjectUser(projectId, userId, { accessToken: token });
  console.log("[APS] removeProjectUser ✓");
}

// --------------------------------------------------------------------------
// Account users
// --------------------------------------------------------------------------

/**
 * Searches users in a Forma account by name or email (partial match).
 * Uses the Hub Admin API — requires account:read scope and provisioning.
 */
export async function searchAccountUsers(
  accountId: string,
  query: string,
  token: string,
): Promise<AccountUser[]> {
  console.log("[APS] searchAccountUsers → AdminClient.searchUsers accountId=%s query=%s", accountId, query);
  console.log(
    "[APS] searchAccountUsers curl:\n  curl -s -X GET 'https://developer.api.autodesk.com/construction/admin/v1/accounts/%s/users/search?name=%s&email=%s&operator=OR&partial=true&limit=20' \\\n    -H 'Authorization: Bearer %s'",
    accountId, encodeURIComponent(query), encodeURIComponent(query), token,
  );
  let results;
  try {
    results = await adminClient.searchUsers(accountId, {
      name: query,
      email: query,
      operator: "OR",
      partial: true,
      limit: 20,
      accessToken: token,
    });
  } catch (err) {
    console.error("[APS] searchAccountUsers error:", err);
    throw err;
  }
  console.log("[APS] searchAccountUsers ✓ got %d result(s)", results.length);
  return results.map((u) => ({
    id: u.id ?? "",
    email: u.email ?? "",
    firstName: u.first_name ?? "",
    lastName: u.last_name ?? "",
    name: u.name ?? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
    status: u.status ?? "",
    companyName: u.company_name ?? "",
  }));
}

// --------------------------------------------------------------------------
// Normalizers
// --------------------------------------------------------------------------

function normalizeUser(raw: SdkProjectUser, projectId: string): ProjectUser {
  const roleIds = raw.roleIds ?? [];
  const role = roleIds[0] ?? "";
  return {
    id: raw.id ?? "",
    projectId,
    email: raw.email ?? "",
    firstName: raw.firstName ?? "",
    lastName: raw.lastName ?? "",
    role,
    roleLabel: roleLabel(role),
    status: raw.status ?? "active",
    createdAt: (raw as unknown as { createdAt?: string }).createdAt ?? "",
    updatedAt: (raw as unknown as { updatedAt?: string }).updatedAt ?? "",
  };
}

function normalizeUserResponse(raw: ProjectUserResponse, projectId: string): ProjectUser {
  const roleIds = raw.roleIds ?? [];
  const role = roleIds[0] ?? "";
  return {
    id: raw.id ?? "",
    projectId,
    email: raw.email ?? "",
    firstName: raw.firstName ?? "",
    lastName: raw.lastName ?? "",
    role,
    roleLabel: roleLabel(role),
    status: raw.status ?? "active",
    createdAt: raw.addedOn ?? "",
    updatedAt: raw.updatedAt ?? "",
  };
}

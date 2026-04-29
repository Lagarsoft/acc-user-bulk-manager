/**
 * Folder-permission helpers for Autodesk Forma / ACC Docs.
 *
 * Features:
 *   - listTopFolders(hubId, projectId)          → Data Management top folders
 *   - listFolderContents(projectId, folderId)   → folders + items under a folder
 *   - resolveFolderPath(hubId, projectId, path) → walks the tree, returns URN
 *   - batchGrantFolderPermissions(...)          → POST permissions:batch-create
 *   - PERMISSION_LEVELS                          → level → APS action array
 *
 * All calls use a 3-legged token (data:read/write scope). The caller must be
 * a project admin for `batchGrantFolderPermissions` — otherwise APS returns 403.
 *
 * IDs: internal `projectId` is the raw UUID (no prefix). Data Management
 * endpoints require the `b.` prefix, so we re-add it here.
 */

import { DataManagementClient } from "@aps_sdk/data-management";
import type { FolderNode, PermissionAction } from "@/app/lib/folder-permission-levels";

export {
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABELS,
  isPermissionLevel,
} from "@/app/lib/folder-permission-levels";
export type {
  FolderNode,
  PermissionAction,
  PermissionLevel,
} from "@/app/lib/folder-permission-levels";

const dmClient = new DataManagementClient();

/** Ensures the `b.` prefix DM APIs require on project IDs. */
function withProjectPrefix(projectId: string): string {
  return projectId.startsWith("b.") ? projectId : `b.${projectId}`;
}

function withHubPrefix(hubId: string): string {
  return hubId.startsWith("b.") ? hubId : `b.${hubId}`;
}

/**
 * Lists the top-level folders visible to the signed-in user in a project.
 * Requires a 3-legged token with `data:read`.
 */
export async function listTopFolders(
  hubId: string,
  projectId: string,
  token: string,
): Promise<FolderNode[]> {
  const hub = withHubPrefix(hubId);
  const proj = withProjectPrefix(projectId);
  console.log("[folders] listTopFolders hubId=%s projectId=%s", hub, proj);
  const response = await dmClient.getProjectTopFolders(hub, proj, {
    accessToken: token,
  });
  return (response.data ?? []).map((f) => ({
    id: f.id,
    name: f.attributes?.name ?? f.attributes?.displayName ?? f.id,
    hidden: (f.attributes as { hidden?: boolean })?.hidden ?? false,
  }));
}

/**
 * Lists the immediate folder children of a folder.
 * Requires a 3-legged token with `data:read`.
 */
export async function listFolderChildren(
  projectId: string,
  folderId: string,
  token: string,
): Promise<FolderNode[]> {
  const proj = withProjectPrefix(projectId);
  const response = await dmClient.getFolderContents(proj, folderId, {
    filterType: ["folders"],
    pageLimit: 200,
    accessToken: token,
  });
  const folders: FolderNode[] = [];
  for (const entry of response.data ?? []) {
    if (entry.type !== "folders") continue;
    const attrs = entry.attributes as {
      name?: string;
      displayName?: string;
      hidden?: boolean;
    } | undefined;
    folders.push({
      id: entry.id,
      name: attrs?.name ?? attrs?.displayName ?? entry.id,
      hidden: attrs?.hidden ?? false,
    });
  }
  return folders;
}

/**
 * Walks a human-readable path like "Project Files/Design/Current"
 * and returns the matching folder URN. Case-insensitive name match.
 * Returns null if any segment cannot be resolved.
 *
 * An optional `cache` Map can be passed to dedupe lookups across many
 * resolutions in the same request batch.
 */
export async function resolveFolderPath(
  hubId: string,
  projectId: string,
  path: string,
  token: string,
  cache?: Map<string, FolderNode[]>,
): Promise<string | null> {
  const segments = path
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  const childrenFor = async (key: string, loader: () => Promise<FolderNode[]>) => {
    if (cache?.has(key)) return cache.get(key)!;
    const list = await loader();
    cache?.set(key, list);
    return list;
  };

  const topKey = `top:${hubId}:${projectId}`;
  let current = await childrenFor(topKey, () => listTopFolders(hubId, projectId, token));

  let resolvedId: string | null = null;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const match = current.find((f) => f.name.toLowerCase() === segment.toLowerCase());
    if (!match) return null;
    resolvedId = match.id;
    if (i < segments.length - 1) {
      const key = `folder:${projectId}:${match.id}`;
      current = await childrenFor(key, () => listFolderChildren(projectId, match.id, token));
    }
  }
  return resolvedId;
}

// --------------------------------------------------------------------------
// Grant permissions
// --------------------------------------------------------------------------

export interface FolderPermissionSubject {
  /** ACC user UUID — NOT the email. Resolve via searchAccountUsers / findAccountUserByEmail first. */
  subjectId: string;
  subjectType?: "USER" | "COMPANY" | "ROLE";
  actions: PermissionAction[];
}

export interface FolderPermissionGrantResult {
  subjectId: string;
  status: "granted" | "error";
  message?: string;
}

/**
 * Batch-creates folder permissions via the ACC Docs endpoint.
 * Not covered by the SDK, so this uses raw fetch.
 *
 * POST /bim360/docs/v1/projects/:projectId/folders/:folderId/permissions:batch-create
 *
 * Docs: https://aps.autodesk.com/en/docs/acc/v1/reference/http/document-management-projects-project_id-folders-folder_id-permissionsbatch-create-POST
 *
 * Requires a 3-legged token with `data:write` and the caller must be a project admin.
 * `projectId` must NOT have the `b.` prefix for this endpoint.
 */
export async function batchGrantFolderPermissions(
  projectId: string,
  folderUrn: string,
  subjects: FolderPermissionSubject[],
  token: string,
): Promise<FolderPermissionGrantResult[]> {
  if (subjects.length === 0) return [];

  const rawProjectId = projectId.startsWith("b.") ? projectId.slice(2) : projectId;
  const url = `https://developer.api.autodesk.com/bim360/docs/v1/projects/${rawProjectId}/folders/${folderUrn}/permissions:batch-create`;

  const payload = subjects.map((s) => ({
    subjectId: s.subjectId,
    subjectType: s.subjectType ?? "USER",
    actions: s.actions,
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  console.log(
    "[folders] batchGrantFolderPermissions response status=%d body=%s",
    response.status, raw,
  );

  if (response.ok) {
    // Endpoint returns an array mirroring the input on success.
    return subjects.map((s) => ({ subjectId: s.subjectId, status: "granted" as const }));
  }

  const parsed = parseAutodeskError(raw, response.status);

  // Autodesk's batch-create is all-or-nothing: one bad subject fails the whole
  // call. If the batch had multiple subjects, retry each on its own so we can
  // attribute errors to specific users and still succeed on the rest.
  if (subjects.length > 1) {
    const individual = await Promise.all(
      subjects.map(async (s) => {
        try {
          const [only] = await batchGrantFolderPermissions(projectId, folderUrn, [s], token);
          return only;
        } catch (err) {
          return {
            subjectId: s.subjectId,
            status: "error" as const,
            message: err instanceof Error ? err.message : "Retry failed",
          };
        }
      }),
    );
    return individual;
  }

  // Single-subject failure: attribute the parsed detail to that subject.
  return subjects.map((s) => ({
    subjectId: s.subjectId,
    status: "error" as const,
    message: explainAutodeskError(parsed, s),
  }));
}

/** Extracts the structured error from an Autodesk response body. */
interface AutodeskErrorDetail {
  code?: string;
  title?: string;
  detail?: string;
  status: number;
  raw: string;
}

function parseAutodeskError(body: string, status: number): AutodeskErrorDetail {
  try {
    const json = JSON.parse(body) as { code?: string; title?: string; detail?: string };
    return { ...json, status, raw: body };
  } catch {
    return { status, raw: body };
  }
}

/**
 * Rewrites an Autodesk folder-permission error into something a human can act
 * on. Today the only pattern we recognize is the "not allow to set actions"
 * message, which fires when the subject already has an equal-or-higher
 * permission (typically via project-admin inheritance or an existing explicit
 * grant).
 */
function explainAutodeskError(err: AutodeskErrorDetail, subject: FolderPermissionSubject): string {
  const detail = err.detail ?? err.raw ?? `HTTP ${err.status}`;
  if (/not allow(ed)? to set actions/i.test(detail)) {
    return (
      "User already has equal-or-higher folder access — often because they are a project admin " +
      "or already have an explicit permission on this folder. Autodesk blocks overwriting via " +
      "batch-create."
    );
  }
  if (/not exist or not active/i.test(detail)) {
    return "One or more subjects are not active project members — ensure all users have accepted their project invite before granting folder permissions.";
  }
  return err.detail ? `${err.title ?? "Autodesk error"}: ${err.detail}` : detail;
  void subject; // reserved for future subject-specific messaging
}

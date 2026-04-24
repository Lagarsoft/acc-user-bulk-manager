/**
 * Folder-permission levels and client-safe types.
 *
 * Kept in its own file so client components can import `PERMISSION_LEVELS` /
 * `PERMISSION_LEVEL_LABELS` / `PermissionLevel` without pulling the APS SDK
 * (Node-only) from folder-permissions.ts into the browser bundle.
 */

export type PermissionLevel =
  | "viewer"
  | "downloader"
  | "uploader"
  | "editor"
  | "manager";

export type PermissionAction =
  | "VIEW"
  | "DOWNLOAD"
  | "COLLABORATE"
  | "PUBLISH_MARKUP"
  | "PUBLISH"
  | "EDIT"
  | "CONTROL";

// ACC Docs rejects a bare VIEW — it must be paired with COLLABORATE.
// Uploader+ adds PUBLISH (upload rights). Mapping cross-checked against the
// reference implementation in AndrzejSamsonowicz/ACC_User_Management_Cloud.
export const PERMISSION_LEVELS: Record<PermissionLevel, PermissionAction[]> = {
  viewer: ["VIEW", "COLLABORATE"],
  downloader: ["VIEW", "DOWNLOAD", "COLLABORATE"],
  uploader: ["VIEW", "DOWNLOAD", "COLLABORATE", "PUBLISH_MARKUP", "PUBLISH"],
  editor: ["VIEW", "DOWNLOAD", "COLLABORATE", "PUBLISH_MARKUP", "PUBLISH", "EDIT"],
  manager: ["VIEW", "DOWNLOAD", "COLLABORATE", "PUBLISH_MARKUP", "PUBLISH", "EDIT", "CONTROL"],
};

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  viewer: "Viewer",
  downloader: "Viewer + Download",
  uploader: "Uploader",
  editor: "Editor",
  manager: "Manager",
};

export function isPermissionLevel(value: string): value is PermissionLevel {
  return value in PERMISSION_LEVELS;
}

export interface FolderNode {
  id: string;
  name: string;
  hidden?: boolean;
}

import type { PermissionLevel } from "@/app/lib/folder-permission-levels";

/** A single queued folder-permission grant, shared across the builder, preview, and results steps. */
export interface FolderEntry {
  id: string;
  email: string;
  projectId: string;
  projectName?: string;
  folderPath: string;
  folderUrn?: string;
  permission: PermissionLevel;
  status?: "pending" | "resolving" | "granted" | "error";
  message?: string;
}

export function newFolderEntryId(): string {
  return `fe-${Math.random().toString(36).slice(2, 10)}`;
}

import type { PermissionLevel } from "@/app/lib/folder-permission-levels";

export type SubjectType = "USER" | "COMPANY" | "ROLE";

/** A single queued folder-permission grant, shared across the builder, preview, and results steps. */
export interface FolderEntry {
  id: string;
  subjectType?: SubjectType;
  email: string;        // USER: email address; COMPANY/ROLE: empty string
  companyId?: string;   // COMPANY: ACC company UUID
  companyName?: string; // COMPANY: display name
  roleId?: string;      // ROLE: project-specific role UUID
  roleName?: string;    // ROLE: display name
  projectId: string;
  projectName?: string;
  folderPath: string;
  folderUrn?: string;
  permission: PermissionLevel;
  status?: "pending" | "resolving" | "granted" | "error";
  message?: string;
}

/** Human-readable label for an entry (email, company name, or role name). */
export function entryLabel(e: FolderEntry): string {
  const type = e.subjectType ?? "USER";
  if (type === "COMPANY") return e.companyName ?? e.companyId ?? "Unknown company";
  if (type === "ROLE") return e.roleName ?? e.roleId ?? "Unknown role";
  return e.email;
}

/** Subject key used to match API results back to entries. */
export function entryKey(e: FolderEntry): string {
  const type = e.subjectType ?? "USER";
  if (type === "COMPANY") return e.companyId ?? "";
  if (type === "ROLE") return e.roleId ?? "";
  return e.email;
}

export function newFolderEntryId(): string {
  return `fe-${Math.random().toString(36).slice(2, 10)}`;
}

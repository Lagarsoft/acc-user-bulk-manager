/**
 * CSV parser for folder-permission grants.
 *
 * Required columns: email, project_id, folder_path, permission
 *
 * `folder_path` is a human-readable path starting at a top-level project folder,
 * e.g. `Project Files/Design/Current`. Leading/trailing slashes are tolerated.
 *
 * `permission` must be one of the keys of PERMISSION_LEVELS
 * (viewer | downloader | uploader | editor | manager).
 */

import { parseLine } from "@/app/lib/csv-parser";
import { isPermissionLevel, type PermissionLevel } from "@/app/lib/folder-permission-levels";

export interface FolderOperationRow {
  rowNumber: number;
  email: string;
  projectId: string;
  folderPath: string;
  permission: PermissionLevel;
}

export interface FolderCsvRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface FolderCsvParseResult {
  operations: FolderOperationRow[];
  errors: FolderCsvRowError[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseFolderCsv(csvText: string): FolderCsvParseResult {
  const operations: FolderOperationRow[] = [];
  const errors: FolderCsvRowError[] = [];

  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) {
    return { operations, errors };
  }

  const headers = parseLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );

  const col = {
    email: headers.indexOf("email"),
    project_id: headers.indexOf("project_id"),
    folder_path: headers.indexOf("folder_path"),
    permission: headers.indexOf("permission"),
  };

  const missing: string[] = [];
  if (col.email === -1) missing.push("email");
  if (col.project_id === -1) missing.push("project_id");
  if (col.folder_path === -1) missing.push("folder_path");
  if (col.permission === -1) missing.push("permission");

  if (missing.length > 0) {
    errors.push({
      rowNumber: 1,
      field: "header",
      message: `Missing required columns: ${missing.join(", ")}`,
    });
    return { operations, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const rowNumber = i + 1;
    const fields = parseLine(line);

    const email = fields[col.email] ?? "";
    const projectId = fields[col.project_id] ?? "";
    const rawFolderPath = fields[col.folder_path] ?? "";
    const folderPath = rawFolderPath.replace(/^\/+|\/+$/g, "");
    const rawPermission = (fields[col.permission] ?? "").toLowerCase();

    const rowErrors: FolderCsvRowError[] = [];

    if (!email) {
      rowErrors.push({ rowNumber, field: "email", message: "email is required" });
    } else if (!EMAIL_RE.test(email)) {
      rowErrors.push({
        rowNumber,
        field: "email",
        message: `"${email}" is not a valid email address`,
      });
    }

    if (!projectId) {
      rowErrors.push({ rowNumber, field: "project_id", message: "project_id is required" });
    }

    if (!folderPath) {
      rowErrors.push({ rowNumber, field: "folder_path", message: "folder_path is required" });
    }

    if (!rawPermission) {
      rowErrors.push({ rowNumber, field: "permission", message: "permission is required" });
    } else if (!isPermissionLevel(rawPermission)) {
      rowErrors.push({
        rowNumber,
        field: "permission",
        message: `"${fields[col.permission]}" is not a valid permission. Accepted: viewer, downloader, uploader, editor, manager`,
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      operations.push({
        rowNumber,
        email,
        projectId,
        folderPath,
        permission: rawPermission as PermissionLevel,
      });
    }
  }

  return { operations, errors };
}

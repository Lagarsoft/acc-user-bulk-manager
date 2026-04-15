/**
 * CSV import parser for bulk user operations.
 *
 * Required columns: email, project_id, action
 * Required for add/update: role
 * Optional columns: first_name, last_name
 *
 * If the `action` column is absent the row defaults to "add" for
 * backwards compatibility with CSVs produced before issue #23.
 *
 * Validates email format, role values, and action values per row.
 * Returns a structured operation queue and a list of per-row errors.
 */

import { AccRole } from "@/app/lib/acc-admin";

// --------------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------------

export type CsvAction = "add" | "update" | "remove";

export interface CsvOperationRow {
  rowNumber: number; // 1-indexed data row (header = row 1, first data row = 2)
  action: CsvAction;
  projectId: string;
  /** Human-readable project name — populated when the user picks via search; absent for CSV uploads. */
  projectName?: string;
  email: string;
  role: AccRole;
  firstName: string;
  lastName: string;
}

export interface CsvRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface CsvParseResult {
  operations: CsvOperationRow[];
  errors: CsvRowError[];
}

// --------------------------------------------------------------------------
// Internal constants
// --------------------------------------------------------------------------

const VALID_ROLES = new Set<string>([
  "admin",
  "member",
  "project_admin",
  "project_manager",
  "gc_foreman",
  "gc_manager",
  "owner",
  "executive",
  "editor",
  "viewer",
]);

const VALID_ACTIONS = new Set<string>(["add", "update", "remove"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --------------------------------------------------------------------------
// CSV parsing
// --------------------------------------------------------------------------

/**
 * Parses a single CSV line, respecting RFC 4180 quoting rules.
 * Fields are trimmed of surrounding whitespace.
 */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

// --------------------------------------------------------------------------
// Main export
// --------------------------------------------------------------------------

/**
 * Parses CSV text and returns a validated operation queue.
 *
 * Rows with validation errors are excluded from `operations` and their
 * errors appear in the `errors` array keyed by row number.
 *
 * Header-level problems (missing required columns) are reported with
 * rowNumber 1 and field "header".
 */
export function parseCsv(csvText: string): CsvParseResult {
  const operations: CsvOperationRow[] = [];
  const errors: CsvRowError[] = [];

  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) {
    return { operations, errors };
  }

  // Parse header row (row 1)
  const headers = parseLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );

  const col = {
    email: headers.indexOf("email"),
    role: headers.indexOf("role"),
    project_id: headers.indexOf("project_id"),
    action: headers.indexOf("action"),
    first_name: headers.indexOf("first_name"),
    last_name: headers.indexOf("last_name"),
  };

  const missingHeaders: string[] = [];
  if (col.email === -1) missingHeaders.push("email");
  if (col.project_id === -1) missingHeaders.push("project_id");

  if (missingHeaders.length > 0) {
    errors.push({
      rowNumber: 1,
      field: "header",
      message: `Missing required columns: ${missingHeaders.join(", ")}`,
    });
    return { operations, errors };
  }

  // Parse data rows (rows 2+)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // skip blank rows

    const rowNumber = i + 1; // header is row 1, first data row is row 2
    const fields = parseLine(line);

    const email = fields[col.email] ?? "";
    const role = col.role >= 0 ? (fields[col.role] ?? "").toLowerCase() : "";
    const projectId = fields[col.project_id] ?? "";
    const rawAction = col.action >= 0 ? (fields[col.action] ?? "").toLowerCase() : "";
    const action = (rawAction || "add") as CsvAction;
    const firstName = col.first_name >= 0 ? (fields[col.first_name] ?? "") : "";
    const lastName = col.last_name >= 0 ? (fields[col.last_name] ?? "") : "";

    const rowErrors: CsvRowError[] = [];

    if (!email) {
      rowErrors.push({ rowNumber, field: "email", message: "email is required" });
    } else if (!EMAIL_RE.test(email)) {
      rowErrors.push({
        rowNumber,
        field: "email",
        message: `"${email}" is not a valid email address`,
      });
    }

    if (rawAction && !VALID_ACTIONS.has(rawAction)) {
      rowErrors.push({
        rowNumber,
        field: "action",
        message: `"${fields[col.action]}" is not a valid action. Accepted: add, update, remove`,
      });
    }

    // role is required for add and update, not for remove
    if (action !== "remove") {
      if (!role) {
        rowErrors.push({ rowNumber, field: "role", message: "role is required for add/update" });
      } else if (!VALID_ROLES.has(role)) {
        rowErrors.push({
          rowNumber,
          field: "role",
          message: `"${fields[col.role!]}" is not a valid role. Accepted: ${[...VALID_ROLES].join(", ")}`,
        });
      }
    }

    if (!projectId) {
      rowErrors.push({
        rowNumber,
        field: "project_id",
        message: "project_id is required",
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      operations.push({
        rowNumber,
        action,
        projectId,
        email,
        role: role as AccRole,
        firstName,
        lastName,
      });
    }
  }

  return { operations, errors };
}

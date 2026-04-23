/**
 * CSV parser for the Import Users wizard step.
 *
 * Required column: email
 * Optional columns: first_name, last_name, company, job_title, phone, industry
 *
 * Validates email format per row, deduplicates by lowercased email (last wins),
 * and returns a structured list of rows ready for the /api/account/users/import route.
 */

import { parseLine } from "@/app/lib/csv-parser";
import type { CsvRowError } from "@/app/lib/csv-parser";

// --------------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------------

export interface UserImportRow {
  /** 1-indexed data row (header = row 1, first data row = 2) when parsed from CSV;
      client-generated UUID when built from the manual table. */
  rowNumber: number;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  phone: string;
  industry: string;
}

export interface UserCsvParseResult {
  users: UserImportRow[];
  errors: CsvRowError[];
}

// --------------------------------------------------------------------------
// Internal constants
// --------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FREE_TEXT = 255;

// --------------------------------------------------------------------------
// Main export
// --------------------------------------------------------------------------

/**
 * Parses CSV text into a list of user-import rows.
 *
 * Rows with validation errors are omitted from `users`; their errors appear
 * in `errors` keyed by row number. Missing required columns produce a
 * header-level error at rowNumber 1.
 */
export function parseUserCsv(csvText: string): UserCsvParseResult {
  const users: UserImportRow[] = [];
  const errors: CsvRowError[] = [];

  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) {
    return { users, errors };
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));

  const col = {
    email: headers.indexOf("email"),
    first_name: headers.indexOf("first_name"),
    last_name: headers.indexOf("last_name"),
    company: headers.indexOf("company"),
    job_title: headers.indexOf("job_title"),
    phone: headers.indexOf("phone"),
    industry: headers.indexOf("industry"),
  };

  if (col.email === -1) {
    errors.push({
      rowNumber: 1,
      field: "header",
      message: "Missing required column: email",
    });
    return { users, errors };
  }

  const seen = new Map<string, number>(); // lowercased-email -> index in users[]

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const rowNumber = i + 1;
    const fields = parseLine(line);

    const email = (fields[col.email] ?? "").trim();
    const firstName = col.first_name >= 0 ? (fields[col.first_name] ?? "") : "";
    const lastName = col.last_name >= 0 ? (fields[col.last_name] ?? "") : "";
    const company = col.company >= 0 ? (fields[col.company] ?? "") : "";
    const jobTitle = col.job_title >= 0 ? (fields[col.job_title] ?? "") : "";
    const phone = col.phone >= 0 ? (fields[col.phone] ?? "") : "";
    const industry = col.industry >= 0 ? (fields[col.industry] ?? "") : "";

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

    for (const [field, value] of [
      ["first_name", firstName],
      ["last_name", lastName],
      ["company", company],
      ["job_title", jobTitle],
      ["phone", phone],
      ["industry", industry],
    ] as const) {
      if (value.length > MAX_FREE_TEXT) {
        rowErrors.push({
          rowNumber,
          field,
          message: `${field} must be ${MAX_FREE_TEXT} characters or fewer`,
        });
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    const row: UserImportRow = {
      rowNumber,
      email,
      firstName,
      lastName,
      company,
      jobTitle,
      phone,
      industry,
    };

    const key = email.toLowerCase();
    const prior = seen.get(key);
    if (prior !== undefined) {
      // Last-wins dedupe: overwrite the earlier entry.
      users[prior] = row;
    } else {
      seen.set(key, users.length);
      users.push(row);
    }
  }

  return { users, errors };
}

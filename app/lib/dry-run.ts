/**
 * Shared types for the dry-run validation API.
 * Used by both the /api/dry-run route handler and the DryRunPreview component.
 */

import type { CsvAction } from "@/app/lib/csv-parser";

export interface DryRunOperationResult {
  rowNumber: number;
  action: CsvAction;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  /** false only when an error blocks execution (e.g. user not found for update). */
  valid: boolean;
  /** Human-readable description of the issue, if any. */
  issue?: string;
  severity?: "error" | "warning";
}

export interface DryRunProjectResult {
  projectId: string;
  operations: DryRunOperationResult[];
}

export interface DryRunResponse {
  results: DryRunProjectResult[];
  summary: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
  };
}

"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/app/lib/analytics";
import type { CsvOperationRow, CsvAction } from "@/app/lib/csv-parser";
import type {
  DryRunResponse,
  DryRunProjectResult,
  DryRunOperationResult,
} from "@/app/lib/dry-run";

interface Props {
  operations: CsvOperationRow[];
  /** Called whenever the error state changes so Dashboard can gate the Next button. */
  onHasErrors: (hasErrors: boolean) => void;
}

/**
 * DryRunPreview — Step 2 of the wizard.
 *
 * Calls POST /api/dry-run with the current operation list and displays a
 * per-project diff with inline validation results. Surfaces errors that must
 * be fixed before execution and warnings the user can acknowledge and proceed.
 */
export default function DryRunPreview({ operations, onHasErrors }: Props) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DryRunResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetch("/api/dry-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations }),
    })
      .then(async (res) => {
        const data: DryRunResponse & { error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        return data as DryRunResponse;
      })
      .then((data) => {
        if (!cancelled) {
          setResult(data);
          onHasErrors(data.summary.errors > 0);
          trackEvent("dryrun_completed", {
            total: data.summary.total,
            valid: data.summary.valid,
            warnings: data.summary.warnings,
            errors: data.summary.errors,
          });
          if (data.summary.errors > 0) {
            trackEvent("dryrun_has_blockers", { error_count: data.summary.errors });
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Unknown error");
          onHasErrors(true);
          trackEvent("dryrun_has_blockers", { error_count: -1 });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="w-8 h-8 border-2 border-[#0696D7] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">Validating operations against Forma…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Failed to run validation: {fetchError}
      </div>
    );
  }

  if (!result) return null;

  const { summary, results } = result;
  const allClear = summary.errors === 0 && summary.warnings === 0;

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <div
        className={`rounded-xl border p-4 flex flex-wrap gap-4 items-center ${
          summary.errors > 0
            ? "border-red-200 bg-red-50"
            : summary.warnings > 0
              ? "border-yellow-200 bg-yellow-50"
              : "border-green-200 bg-green-50"
        }`}
      >
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              summary.errors > 0
                ? "text-red-900"
                : summary.warnings > 0
                  ? "text-yellow-900"
                  : "text-green-900"
            }`}
          >
            {summary.errors > 0
              ? `${summary.errors} error${summary.errors !== 1 ? "s" : ""} found — fix before executing`
              : summary.warnings > 0
                ? "Validation passed with warnings — review before executing"
                : "All operations validated successfully"}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              summary.errors > 0
                ? "text-red-700"
                : summary.warnings > 0
                  ? "text-yellow-700"
                  : "text-green-700"
            }`}
          >
            {summary.total} operations · {summary.valid} valid
            {summary.warnings > 0 && ` · ${summary.warnings} warnings`}
            {summary.errors > 0 && ` · ${summary.errors} errors`}
          </p>
        </div>
        <div className="flex gap-3 text-sm font-medium">
          {allClear && <span className="text-green-700">{summary.valid} ✓</span>}
          {summary.warnings > 0 && (
            <span className="text-yellow-700">{summary.warnings} ⚠</span>
          )}
          {summary.errors > 0 && (
            <span className="text-red-700">{summary.errors} ✕</span>
          )}
        </div>
      </div>

      {/* Per-project diffs */}
      {results.map((projectResult) => (
        <ProjectDiff key={projectResult.projectId} result={projectResult} />
      ))}

      {/* Rollback strategy */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-700">Rollback strategy</p>
        <p>
          Operations are applied per-project in sequence. If a project fails mid-way,
          already-completed projects are <strong>not automatically reversed</strong>.
        </p>
        <p>
          After execution, use the <strong>Download rollback CSV</strong> button to get an
          inverse CSV — adds become removes and removes become adds — which you can re-upload
          to undo completed changes manually.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProjectDiff({ result }: { result: DryRunProjectResult }) {
  const adds = result.operations.filter((o) => o.action === "add").length;
  const updates = result.operations.filter((o) => o.action === "update").length;
  const removes = result.operations.filter((o) => o.action === "remove").length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Project header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            {result.projectName ?? "Project"}
          </p>
          <p className="text-xs text-gray-500 font-mono truncate">{result.projectId}</p>
        </div>
        <div className="flex gap-2 text-xs shrink-0">
          {adds > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              +{adds} add
            </span>
          )}
          {updates > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
              ~{updates} update
            </span>
          )}
          {removes > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              −{removes} remove
            </span>
          )}
        </div>
      </div>

      {/* Operations table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
                Action
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Email
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">
                Role
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Validation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {result.operations.map((op, idx) => (
              <OpRow key={idx} op={op} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpRow({ op }: { op: DryRunOperationResult }) {
  const rowBg =
    op.severity === "error"
      ? "bg-red-50"
      : op.severity === "warning"
        ? "bg-yellow-50"
        : op.action === "add"
          ? "bg-green-50"
          : op.action === "update"
            ? "bg-amber-50"
            : "bg-red-50";

  return (
    <tr className={rowBg}>
      <td className="px-4 py-2">
        <ActionBadge action={op.action} />
      </td>
      <td className="px-4 py-2 text-gray-900">{op.email}</td>
      <td className="px-4 py-2 text-gray-700">{op.roles.length > 0 ? op.roles.join(", ") : "—"}</td>
      <td className="px-4 py-2">
        {op.issue ? (
          <span
            className={`text-xs ${
              op.severity === "error" ? "text-red-700" : "text-yellow-700"
            }`}
          >
            {op.severity === "error" ? "✕" : "⚠"} {op.issue}
          </span>
        ) : (
          <span className="text-xs text-green-600">✓ OK</span>
        )}
      </td>
    </tr>
  );
}

function ActionBadge({ action }: { action: CsvAction }) {
  switch (action) {
    case "add":
      return (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
          +&nbsp;add
        </span>
      );
    case "update":
      return (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
          ~&nbsp;update
        </span>
      );
    case "remove":
      return (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
          −&nbsp;remove
        </span>
      );
  }
}

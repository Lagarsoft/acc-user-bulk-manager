"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { CsvOperationRow } from "@/app/lib/csv-parser";

type OpStatus = "pending" | "running" | "success" | "error";
type CsvAction = "add" | "update" | "remove";

interface QueueItem extends CsvOperationRow {
  action?: CsvAction; // added in #23; optional for backwards compatibility
  status: OpStatus;
  errorMessage?: string;
}

interface Props {
  operations: CsvOperationRow[];
  onClear: () => void;
}

export default function OperationQueue({ operations, onClear }: Props) {
  const [items, setItems] = useState<QueueItem[]>(() =>
    operations.map((op) => ({ ...op, status: "pending" })),
  );
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  const counts = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      success: items.filter((i) => i.status === "success").length,
      error: items.filter((i) => i.status === "error").length,
    }),
    [items],
  );

  // Execution is considered complete once the queue has run and nothing is still in progress.
  const isExecutionComplete =
    !running &&
    counts.total > 0 &&
    counts.pending + items.filter((i) => i.status === "running").length === 0;

  const completed = counts.success + counts.error;
  const progressPct =
    counts.total > 0 ? Math.round((completed / counts.total) * 100) : 0;

  /** Runs all pending operations in `startItems` sequentially. */
  const executeQueue = useCallback(async (startItems: QueueItem[]) => {
    setRunning(true);
    cancelRef.current = false;

    // Local status mirror so the async loop always sees up-to-date statuses
    // even though React state updates are batched.
    const statuses: OpStatus[] = startItems.map((i) => i.status);

    for (let i = 0; i < startItems.length; i++) {
      if (cancelRef.current) break;
      if (statuses[i] !== "pending") continue;

      statuses[i] = "running";
      setItems((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: "running" };
        return next;
      });

      const op = startItems[i];

      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(op.projectId)}/users`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              users: [
                {
                  email: op.email,
                  role: op.role,
                  ...(op.firstName ? { firstName: op.firstName } : {}),
                  ...(op.lastName ? { lastName: op.lastName } : {}),
                },
              ],
            }),
          },
        );

        if (!res.ok) {
          const data: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        statuses[i] = "success";
        setItems((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "success", errorMessage: undefined };
          return next;
        });
      } catch (err) {
        statuses[i] = "error";
        const message = err instanceof Error ? err.message : "Unknown error";
        setItems((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "error", errorMessage: message };
          return next;
        });
      }
    }

    setRunning(false);
  }, []);

  function handleExecuteAll() {
    executeQueue(items);
  }

  function handleRetryFailed() {
    const reset = items.map((item) =>
      item.status === "error"
        ? { ...item, status: "pending" as const, errorMessage: undefined }
        : item,
    );
    setItems(reset);
    executeQueue(reset);
  }

  function handleCancel() {
    cancelRef.current = true;
  }

  function downloadRollbackCsv() {
    const succeeded = items.filter((i) => i.status === "success");
    const rows: string[] = ["email,project_id,action,role,first_name,last_name"];
    for (const item of succeeded) {
      const originalAction: CsvAction = item.action ?? "add";
      let rollbackAction: CsvAction;
      if (originalAction === "add") rollbackAction = "remove";
      else if (originalAction === "remove") rollbackAction = "add";
      else rollbackAction = "update";
      const q = (v: string) => (v.includes(",") ? `"${v.replace(/"/g, '""')}"` : v);
      rows.push(
        [
          q(item.email),
          q(item.projectId),
          rollbackAction,
          q(item.role ?? ""),
          q(item.firstName ?? ""),
          q(item.lastName ?? ""),
        ].join(","),
      );
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rollback.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const StatusBadge = ({ status, error }: { status: OpStatus; error?: string }) => {
    switch (status) {
      case "pending":
        return <span className="text-gray-400 text-xs">Pending</span>;
      case "running":
        return (
          <span className="text-blue-600 text-xs flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Running
          </span>
        );
      case "success":
        return <span className="text-green-600 text-xs font-medium">✓ Done</span>;
      case "error":
        return (
          <span className="text-red-600 text-xs" title={error}>
            ✕ {error ? error.slice(0, 60) + (error.length > 60 ? "…" : "") : "Error"}
          </span>
        );
    }
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm text-gray-600">
          {counts.total} operation{counts.total !== 1 ? "s" : ""}
          {counts.success > 0 && (
            <span className="text-green-600"> · {counts.success} done</span>
          )}
          {counts.error > 0 && (
            <span className="text-red-600"> · {counts.error} failed</span>
          )}
          {counts.pending > 0 && (
            <span className="text-gray-400"> · {counts.pending} pending</span>
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {counts.error > 0 && !running && (
            <button
              onClick={handleRetryFailed}
              className="text-sm text-blue-600 hover:underline"
            >
              Retry failed
            </button>
          )}
          {running ? (
            <button
              onClick={handleCancel}
              className="bg-gray-200 text-gray-700 py-1.5 px-3 rounded-md text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                onClick={onClear}
                className="text-sm text-gray-500 hover:underline"
              >
                Clear
              </button>
              <button
                onClick={handleExecuteAll}
                disabled={counts.pending === 0}
                className="bg-blue-600 text-white py-1.5 px-3 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Execute All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(running || completed > 0) && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>
              {completed} / {counts.total} ({progressPct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Post-execution summary */}
      {isExecutionComplete && (
        <div className="mb-5 rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Execution complete</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <div className="text-xl font-semibold text-green-700">{counts.success}</div>
              <div className="text-xs text-green-600">Succeeded</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <div className="text-xl font-semibold text-red-700">{counts.error}</div>
              <div className="text-xs text-red-600">Failed</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xl font-semibold text-gray-600">{counts.pending}</div>
              <div className="text-xs text-gray-500">Skipped</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {counts.success > 0 && (
              <button
                onClick={downloadRollbackCsv}
                className="text-sm bg-gray-100 text-gray-700 py-1.5 px-3 rounded-md hover:bg-gray-200 font-medium"
              >
                Download rollback CSV
              </button>
            )}
            <button
              onClick={onClear}
              className="text-sm bg-blue-600 text-white py-1.5 px-3 rounded-md hover:bg-blue-700 font-medium"
            >
              Start new operation
            </button>
          </div>
        </div>
      )}

      {/* Queue table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Row
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Project ID
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {items.map((item, idx) => (
                <tr
                  key={idx}
                  className={
                    item.status === "success"
                      ? "bg-green-50"
                      : item.status === "error"
                        ? "bg-red-50"
                        : item.status === "running"
                          ? "bg-blue-50"
                          : ""
                  }
                >
                  <td className="px-4 py-2 text-gray-400 tabular-nums">{item.rowNumber}</td>
                  <td className="px-4 py-2 text-gray-900">{item.email}</td>
                  <td className="px-4 py-2 text-gray-700">{item.role}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{item.projectId}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={item.status} error={item.errorMessage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

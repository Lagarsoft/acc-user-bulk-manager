"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Project } from "@/app/lib/acc-admin";
import type { CsvOperationRow } from "@/app/lib/csv-parser";

type CsvAction = "add" | "update" | "remove";
type OpStatus = "pending" | "running" | "success" | "error";

interface QueueItem extends CsvOperationRow {
  // Ensure action is always present (may not exist on older main-branch rows)
  action: CsvAction;
  status: OpStatus;
  errorMessage?: string;
}

// A blank editable row being composed by the user before appending to the queue.
interface NewRow {
  email: string;
  role: string;
  projectId: string;
  action: CsvAction;
}

interface Props {
  operations: CsvOperationRow[];
  projects: Project[];
  onClear: () => void;
  autoExecute?: boolean;
}

const VALID_ROLES = [
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
];

const BLANK_NEW_ROW: NewRow = { email: "", role: "", projectId: "", action: "add" };

function toQueueItem(op: CsvOperationRow): QueueItem {
  return {
    ...op,
    action: (op as QueueItem).action ?? "add",
    status: "pending",
  };
}

export default function OperationQueue({ operations, projects, onClear, autoExecute }: Props) {
  const [items, setItems] = useState<QueueItem[]>(() => operations.map(toQueueItem));
  const [running, setRunning] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<NewRow>(BLANK_NEW_ROW);
  const cancelRef = useRef(false);

  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const counts = useMemo(
    () => ({
      total: items.length,
      add: items.filter((i) => i.action === "add").length,
      update: items.filter((i) => i.action === "update").length,
      remove: items.filter((i) => i.action === "remove").length,
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

  function deleteItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function commitNewRow() {
    if (!newRow.email || !newRow.projectId) return;
    const op: QueueItem = {
      rowNumber: 0,
      action: newRow.action,
      projectId: newRow.projectId,
      email: newRow.email,
      role: newRow.role as QueueItem["role"],
      firstName: "",
      lastName: "",
      status: "pending",
    };
    setItems((prev) => [...prev, op]);
    setNewRow(BLANK_NEW_ROW);
    setAddingRow(false);
  }

  /** Executes a single operation based on its action type. */
  async function executeOp(op: QueueItem): Promise<void> {
    if (op.action === "add") {
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
      return;
    }

    // update and remove: resolve userId via GET first
    const listRes = await fetch(
      `/api/projects/${encodeURIComponent(op.projectId)}/users`,
    );
    if (!listRes.ok) {
      const data: { error?: string } = await listRes.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${listRes.status}`);
    }
    const listData: { users?: { id: string; email: string }[] } = await listRes.json();
    const match = (listData.users ?? []).find(
      (u) => u.email.toLowerCase() === op.email.toLowerCase(),
    );
    if (!match) throw new Error(`User "${op.email}" not found in project`);

    if (op.action === "update") {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(op.projectId)}/users/${encodeURIComponent(match.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: op.role }),
        },
      );
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      return;
    }

    // remove
    const res = await fetch(
      `/api/projects/${encodeURIComponent(op.projectId)}/users/${encodeURIComponent(match.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 204) {
      const data: { error?: string } = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
  }

  /** Runs all pending operations in `startItems` sequentially. */
  const executeQueue = useCallback(async (startItems: QueueItem[]) => {
    setRunning(true);
    cancelRef.current = false;

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

      try {
        await executeOp(startItems[i]);

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

  // Auto-start execution when mounted in execution mode (step 3).
  useEffect(() => {
    if (autoExecute) executeQueue(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const ActionBadge = ({ action }: { action: CsvAction }) => {
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
  };

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

  const selectClass =
    "border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-aps-blue";

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
          <span className="text-green-500 text-lg font-bold">+</span>
          <div>
            <div className="text-xl font-semibold text-green-700">{counts.add}</div>
            <div className="text-xs text-green-600">Users to add</div>
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
          <span className="text-red-500 text-lg font-bold">−</span>
          <div>
            <div className="text-xl font-semibold text-red-700">{counts.remove}</div>
            <div className="text-xs text-red-600">Users to remove</div>
          </div>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 flex items-center gap-3">
          <span className="text-yellow-500 text-lg font-bold">~</span>
          <div>
            <div className="text-xl font-semibold text-yellow-700">{counts.update}</div>
            <div className="text-xs text-yellow-600">Role updates</div>
          </div>
        </div>
      </div>

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
              className="text-sm text-aps-blue hover:underline"
            >
              Retry failed
            </button>
          )}
          {running && (
            <button
              onClick={handleCancel}
              className="bg-gray-200 text-gray-700 py-1.5 px-3 rounded-md text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
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
              className="h-full bg-aps-blue transition-all duration-300"
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
                  Action
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Project
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-2 py-2" />
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
                  <td className="px-4 py-2 text-gray-400 tabular-nums">
                    {item.rowNumber > 0 ? item.rowNumber : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <ActionBadge action={item.action} />
                  </td>
                  <td className="px-4 py-2 text-gray-900">{item.email}</td>
                  <td className="px-4 py-2 text-gray-700">{item.role || "—"}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {projectNames[item.projectId] ?? item.projectId}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={item.status} error={item.errorMessage} />
                  </td>
                  <td className="px-2 py-2">
                    {item.status === "pending" && !running && (
                      <button
                        onClick={() => deleteItem(idx)}
                        className="text-gray-300 hover:text-red-500 text-sm leading-none"
                        title="Remove this operation"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              {addingRow ? (
                <tr>
                  <td className="px-4 py-2 text-gray-400">—</td>
                  <td className="px-4 py-2">
                    <select
                      value={newRow.action}
                      onChange={(e) =>
                        setNewRow((r) => ({ ...r, action: e.target.value as CsvAction }))
                      }
                      className={selectClass}
                    >
                      <option value="add">add</option>
                      <option value="update">update</option>
                      <option value="remove">remove</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={newRow.email}
                      onChange={(e) => setNewRow((r) => ({ ...r, email: e.target.value }))}
                      className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-aps-blue"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {newRow.action !== "remove" && (
                      <select
                        value={newRow.role}
                        onChange={(e) => setNewRow((r) => ({ ...r, role: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="">— role —</option>
                        {VALID_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={newRow.projectId}
                      onChange={(e) => setNewRow((r) => ({ ...r, projectId: e.target.value }))}
                      className={selectClass}
                    >
                      <option value="">— project —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2" />
                  <td className="px-2 py-2 flex gap-1">
                    <button
                      onClick={commitNewRow}
                      disabled={!newRow.email || !newRow.projectId}
                      className="text-xs bg-aps-blue text-white px-2 py-0.5 rounded disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAddingRow(false);
                        setNewRow(BLANK_NEW_ROW);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-2">
                    <button
                      onClick={() => setAddingRow(true)}
                      disabled={running}
                      className="text-xs text-aps-blue hover:underline disabled:opacity-40"
                    >
                      + Add operation
                    </button>
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

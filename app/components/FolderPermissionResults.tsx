"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FolderEntry } from "@/app/lib/folder-entry";
import { PERMISSION_LEVEL_LABELS } from "@/app/lib/folder-permission-levels";
import { trackEvent } from "@/app/lib/analytics";

interface Props {
  entries: FolderEntry[];
  onChangeEntries: (entries: FolderEntry[]) => void;
  accountId: string | null;
  hubId: string | null;
  onFinish: () => void;
  /** Auto-start execution on mount, matching the OperationQueue pattern. */
  autoExecute?: boolean;
}

/**
 * Folder Permission Results — step 3/3 of the Folder Permissions workflow.
 *
 * Resolves folder paths (if needed), batch-grants permissions per
 * (project, folder, permission) group, and renders per-row status.
 */
export default function FolderPermissionResults({
  entries,
  onChangeEntries,
  accountId,
  hubId,
  onFinish,
  autoExecute,
}: Props) {
  const [running, setRunning] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const pending = useMemo(() => entries.filter((e) => e.status !== "granted"), [entries]);
  const grantedCount = entries.filter((e) => e.status === "granted").length;
  const errorCount = entries.filter((e) => e.status === "error").length;
  const isComplete = !running && entries.length > 0 && pending.length === 0;

  const execute = useCallback(async () => {
    if (!accountId || entries.length === 0 || running) return;
    setRunning(true);
    setTopError(null);
    trackEvent("folder_permission_run_started", { count: entries.length });

    try {
      // Snapshot entries into a working copy we can mutate for the API calls,
      // then write state back in two rounds.
      const working = entries.map((e) => ({ ...e }));

      // Step 1 — resolve any paths missing a folderUrn, grouped by project.
      const byProject = new Map<string, FolderEntry[]>();
      for (const e of working) {
        if (!byProject.has(e.projectId)) byProject.set(e.projectId, []);
        byProject.get(e.projectId)!.push(e);
      }

      for (const [projectId, rows] of byProject.entries()) {
        const needsResolve = rows.filter((r) => !r.folderUrn);
        if (needsResolve.length === 0) continue;

        const ids = new Set(needsResolve.map((r) => r.id));
        onChangeEntries(
          working.map((p) =>
            ids.has(p.id) ? { ...p, status: "resolving" as const } : p,
          ),
        );

        const paths = Array.from(new Set(needsResolve.map((r) => r.folderPath)));
        const res = await fetch("/api/folders/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hubId, projectId, paths }),
        });
        const data: { resolved?: Record<string, string | null>; error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

        const resolved = data.resolved ?? {};
        for (const row of needsResolve) {
          const urn = resolved[row.folderPath] ?? null;
          if (!urn) {
            row.status = "error";
            row.message = "Folder path not found";
          } else {
            row.folderUrn = urn;
            row.status = "pending";
          }
        }
        onChangeEntries(working.map((p) => ({ ...p })));
      }

      // Step 2 — group by (project, folder, permission) and POST in batches.
      const groupKey = (e: FolderEntry) =>
        `${e.projectId}::${e.folderUrn}::${e.permission}`;
      const groups = new Map<string, FolderEntry[]>();
      for (const e of working) {
        if (!e.folderUrn) continue;
        const k = groupKey(e);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(e);
      }

      for (const batch of groups.values()) {
        const first = batch[0];
        const res = await fetch("/api/folders/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            projectId: first.projectId,
            folderUrn: first.folderUrn,
            grants: batch.map((b) => ({ email: b.email, permission: b.permission })),
          }),
        });
        const data: {
          results?: Array<{ email: string; status: "granted" | "error"; message?: string }>;
          error?: string;
        } = await res.json();

        if (!res.ok) {
          const msg = data.error ?? `HTTP ${res.status}`;
          for (const row of batch) {
            row.status = "error";
            row.message = msg;
          }
          onChangeEntries(working.map((p) => ({ ...p })));
          continue;
        }

        const resultByEmail = new Map<string, { status: "granted" | "error"; message?: string }>();
        for (const r of data.results ?? []) resultByEmail.set(r.email.toLowerCase(), r);

        for (const row of batch) {
          const r = resultByEmail.get(row.email.toLowerCase());
          if (!r) {
            row.status = "error";
            row.message = "No result returned";
          } else {
            row.status = r.status;
            row.message = r.message;
          }
        }
        onChangeEntries(working.map((p) => ({ ...p })));
      }

      trackEvent("folder_permission_run_finished", { count: working.length });
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }, [accountId, hubId, entries, running, onChangeEntries]);

  useEffect(() => {
    if (!autoExecute || startedRef.current) return;
    if (entries.length === 0 || !accountId) return;
    startedRef.current = true;
    void execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retryFailed() {
    startedRef.current = false;
    onChangeEntries(
      entries.map((e) =>
        e.status === "error"
          ? { ...e, status: "pending" as const, message: undefined }
          : e,
      ),
    );
    // let React flush then re-run
    setTimeout(() => {
      startedRef.current = true;
      void execute();
    }, 0);
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Queued" value={entries.length} tone="gray" />
        <StatCard label="Granted" value={grantedCount} tone="green" />
        <StatCard label="Errors" value={errorCount} tone="red" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">
          {running
            ? "Applying grants…"
            : isComplete
              ? "Execution complete"
              : "Ready to apply"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {errorCount > 0 && !running && (
            <button
              type="button"
              onClick={retryFailed}
              className="text-sm text-[#0696D7] hover:underline"
            >
              Retry failed
            </button>
          )}
          {isComplete && (
            <button
              type="button"
              onClick={onFinish}
              className="bg-[#0696D7] hover:bg-[#0580BC] text-white text-sm font-medium py-1.5 px-4 rounded-md"
            >
              Finish
            </button>
          )}
        </div>
      </div>

      {/* Entries table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Project</th>
              <th className="text-left px-4 py-2 font-medium">Folder</th>
              <th className="text-left px-4 py-2 font-medium">Permission</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((e) => (
              <tr
                key={e.id}
                className={
                  e.status === "granted"
                    ? "bg-green-50"
                    : e.status === "error"
                      ? "bg-red-50"
                      : ""
                }
              >
                <td className="px-4 py-2 truncate max-w-[14rem]">{e.email}</td>
                <td className="px-4 py-2 truncate max-w-[12rem]" title={e.projectId}>
                  {e.projectName ?? e.projectId}
                </td>
                <td className="px-4 py-2 truncate max-w-[16rem]" title={e.folderPath}>
                  {e.folderPath}
                </td>
                <td className="px-4 py-2 text-xs text-gray-600">
                  {PERMISSION_LEVEL_LABELS[e.permission] ?? e.permission}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={e.status} message={e.message} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {topError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {topError}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "gray" | "green" | "red";
}) {
  const styles = {
    gray: "border-gray-200 bg-gray-50 text-gray-700",
    green: "border-green-200 bg-green-50 text-green-700",
    red: "border-red-200 bg-red-50 text-red-700",
  }[tone];
  return (
    <div className={`rounded-lg border px-4 py-3 ${styles}`}>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function StatusBadge({
  status,
  message,
}: {
  status?: FolderEntry["status"];
  message?: string;
}) {
  if (!status) return <span className="text-xs text-gray-400">Ready</span>;
  if (status === "resolving") return <span className="text-xs text-gray-500">Resolving…</span>;
  if (status === "pending") return <span className="text-xs text-gray-500">Applying…</span>;
  if (status === "granted")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        ✓ Granted
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full"
      title={message}
    >
      ✕ {message ?? "Error"}
    </span>
  );
}

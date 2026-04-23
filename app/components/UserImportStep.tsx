"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AccountRegion, AccountUserImportResult, Hub } from "@/app/lib/acc-admin";
import type { UserImportRow } from "@/app/lib/user-csv-parser";
import { trackEvent } from "@/app/lib/analytics";
import HubSelector from "@/app/components/HubSelector";
import UserImportManualTable from "@/app/components/UserImportManualTable";
import UserImportCsvUploader from "@/app/components/UserImportCsvUploader";

/**
 * State bubbled up to Dashboard so the WizardLayout header can drive the
 * primary action (Create Users) without duplicating logic.
 */
export interface UserImportStepState {
  hasRows: boolean;
  running: boolean;
  pendingCount: number;
  runImport: () => Promise<void>;
}

interface Props {
  hubs: Hub[];
  selectedHubId: string | null;
  onSelectHub: (id: string) => void;
  onStateChange: (state: UserImportStepState) => void;
  onImportComplete: (results: AccountUserImportResult[]) => void;
}

type Mode = "manual" | "csv";

function deriveRegion(hub: Hub | undefined): AccountRegion {
  const r = hub?.region?.toUpperCase() ?? "US";
  if (r === "EMEA" || r === "EU") return "EMEA";
  return "US";
}

/**
 * UserImportStep — the first wizard step. Admin loads users via a manual
 * table or a CSV upload. Navigation (Skip / Create Users) lives in the
 * WizardLayout header, driven via onStateChange. When the import finishes
 * the parent is notified via onImportComplete and advances to the Results
 * step.
 */
export default function UserImportStep({
  hubs,
  selectedHubId,
  onSelectHub,
  onStateChange,
  onImportComplete,
}: Props) {
  const [mode, setMode] = useState<Mode>("manual");
  const [rows, setRows] = useState<UserImportRow[]>([]);
  const [running, setRunning] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  const selectedHub = hubs.find((h) => h.id === selectedHubId);
  const accountId = selectedHub?.accountId ?? null;
  const region = deriveRegion(selectedHub);

  function switchMode(next: Mode) {
    setMode(next);
    setRows([]);
    setTopError(null);
    trackEvent("user_import_mode_changed", { mode: next });
  }

  function clearQueue() {
    setRows([]);
    setTopError(null);
  }

  // Ref so the bubbled-up runImport always sees current state.
  const onImportCompleteRef = useRef(onImportComplete);
  onImportCompleteRef.current = onImportComplete;

  const runImportRef = useRef<() => Promise<void>>(() => Promise.resolve());
  runImportRef.current = async () => {
    if (!accountId || rows.length === 0 || running) return;

    setRunning(true);
    setTopError(null);
    trackEvent("user_import_started", { count: rows.length, region });

    try {
      const res = await fetch("/api/account/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          region,
          users: rows.map((r) => ({
            email: r.email,
            firstName: r.firstName || undefined,
            lastName: r.lastName || undefined,
            company: r.company || undefined,
            jobTitle: r.jobTitle || undefined,
            phone: r.phone || undefined,
            industry: r.industry || undefined,
          })),
        }),
      });

      const data: { results?: AccountUserImportResult[]; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const imported = data.results ?? [];
      const created = imported.filter((r) => r.status === "created").length;
      const exists = imported.filter((r) => r.status === "exists").length;
      const errored = imported.filter((r) => r.status === "error").length;
      trackEvent("user_import_finished", { created, exists, errored });
      onImportCompleteRef.current(imported);
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setRunning(false);
    }
  };

  const hasRows = rows.length > 0;

  // Bubble up state + action to parent so it can render the header button.
  const state = useMemo<UserImportStepState>(
    () => ({
      hasRows,
      running,
      pendingCount: rows.length,
      runImport: () => runImportRef.current(),
    }),
    [hasRows, running, rows.length],
  );

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  useEffect(() => {
    onStateChangeRef.current(state);
  }, [state]);

  return (
    <div className="space-y-4">
      {/* Hub selector — only shown when the user belongs to multiple hubs */}
      <HubSelector
        hubs={hubs}
        selectedHubId={selectedHubId}
        onSelect={(id) => {
          onSelectHub(id);
          const hub = hubs.find((h) => h.id === id);
          if (hub) trackEvent("hub_selected", { hub_id: hub.id, hub_name: hub.name });
        }}
        required
      />

      {/* Pill toggle — mirrors Dashboard Permissions step */}
      <div className="bg-white border border-gray-200 rounded-xl p-1.5 flex gap-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          onClick={() => switchMode("manual")}
          disabled={running}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
            mode === "manual"
              ? "bg-[#0696D7] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Build Manually
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "csv"}
          onClick={() => switchMode("csv")}
          disabled={running}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
            mode === "csv"
              ? "bg-[#0696D7] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Upload CSV
        </button>
      </div>

      {/* Input panel */}
      {mode === "manual" && (
        <UserImportManualTable
          accountId={accountId}
          onChange={setRows}
          disabled={running}
        />
      )}
      {mode === "csv" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <UserImportCsvUploader onResult={(users) => setRows(users)} />
        </div>
      )}

      {/* Ready-to-import summary — mirrors Dashboard CSV-mode summary */}
      {hasRows && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {rows.length} user{rows.length === 1 ? "" : "s"} ready — existing accounts will be skipped automatically
            </p>
            {mode === "csv" && !running && (
              <button
                type="button"
                onClick={clearQueue}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top-level error */}
      {topError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Import request failed</p>
          <p className="mt-1 text-xs">{topError}</p>
        </div>
      )}
    </div>
  );
}

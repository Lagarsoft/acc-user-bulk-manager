"use client";

import { useState, useCallback, useEffect } from "react";
import type { Hub, Project } from "@/app/lib/acc-admin";
import type { CsvOperationRow, CsvRowError } from "@/app/lib/csv-parser";
import StepNav from "@/app/components/StepNav";
import WizardLayout from "@/app/components/WizardLayout";
import CsvUploader from "@/app/components/CsvUploader";
import OperationQueue from "@/app/components/OperationQueue";
import DryRunPreview from "@/app/components/DryRunPreview";
import HubSelector from "@/app/components/HubSelector";
import ProjectLookup from "@/app/components/ProjectLookup";
import UserLookup from "@/app/components/UserLookup";
import ManualEntryTable from "@/app/components/ManualEntryTable";

interface Props {
  initialHubs: Hub[];
  initialError: string | null;
}

/** Keeps only ACC / BIM360 / Forma hubs. Falls back to all hubs if none match. */
function filterRelevantHubs(hubs: Hub[]): Hub[] {
  const relevant = hubs.filter((h) => {
    const t = h.type?.toLowerCase() ?? "";
    return t.includes("bim360") || t.includes("acc") || t.includes("forma");
  });
  return relevant.length > 0 ? relevant : hubs;
}

/**
 * Dashboard — orchestrates the 4-step bulk-import wizard.
 *
 * Step 0: Input Data      — hub selector, project lookup, CSV upload
 * Step 1: Bulk Queue      — review / edit operations; advance to dry-run
 * Step 2: Preview Changes — dry-run diff and validation
 * Step 3: Execution       — run operations
 */
export default function Dashboard({ initialHubs, initialError }: Props) {
  const [step, setStep] = useState(0);
  const [queueOps, setQueueOps] = useState<CsvOperationRow[] | null>(null);
  const [error] = useState<string | null>(initialError);
  const [dryRunHasErrors, setDryRunHasErrors] = useState(false);
  const [inputMode, setInputMode] = useState<"manual" | "csv">("manual");

  const [hubs, setHubs] = useState<Hub[]>(initialHubs);

  // Re-fetch hubs client-side so the selector works even when the
  // server-side fetch in page.tsx fails (e.g. auth not ready at SSR time).
  useEffect(() => {
    if (hubs.length > 0) return; // already have hubs from SSR
    fetch("/api/hubs")
      .then(async (res) => {
        const data: { hubs?: Hub[]; error?: string } = await res.json();
        if (!res.ok) return;
        setHubs(data.hubs ?? []);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hub selection — auto-select when only one relevant hub is available.
  const [selectedHubId, setSelectedHubId] = useState<string | null>(() => {
    const relevant = filterRelevantHubs(initialHubs);
    return relevant.length === 1 ? relevant[0].id : null;
  });

  // When hubs load client-side (SSR returned none), apply the same logic.
  useEffect(() => {
    if (selectedHubId) return;
    const relevant = filterRelevantHubs(hubs);
    if (relevant.length === 1) setSelectedHubId(relevant[0].id);
  }, [hubs, selectedHubId]);

  // Project cache — populated lazily as the user searches and picks projects.
  // Passed to OperationQueue so it can display project names.
  const [projectCache, setProjectCache] = useState<Record<string, Project>>({});

  const handleProjectCached = useCallback((project: Project) => {
    setProjectCache((prev) => (prev[project.id] ? prev : { ...prev, [project.id]: project }));
  }, []);

  // Clear the cache when the hub changes (projects belong to a specific hub).
  useEffect(() => {
    setProjectCache({});
  }, [selectedHubId]);

  const handleCsvResult = useCallback((ops: CsvOperationRow[], _errors: CsvRowError[]) => {
    setQueueOps(ops);
  }, []);

  const handleManualResult = useCallback((ops: CsvOperationRow[]) => {
    setQueueOps(ops.length > 0 ? ops : null);
  }, []);

  function switchInputMode(mode: "manual" | "csv") {
    setInputMode(mode);
    setQueueOps(null);
  }

  const handleClearQueue = useCallback(() => {
    setQueueOps(null);
    setStep(0);
  }, []);

  return (
    <div className="min-h-full bg-gray-50">
      <StepNav currentStep={step} />

      {/* ── Step 0: Input Data ─────────────────────────────── */}
      {step === 0 && (
        <WizardLayout
          title="Input Data"
          subtitle="Build your operation list manually or import a CSV file."
          nextLabel="Continue to Queue"
          canAdvance={queueOps !== null && queueOps.length > 0 && (inputMode !== "csv" || selectedHubId !== null)}
          onNext={() => setStep(1)}
          showBack={false}
        >
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Hub selector — only visible when user belongs to multiple hubs */}
            <HubSelector
              hubs={filterRelevantHubs(hubs)}
              selectedHubId={selectedHubId}
              onSelect={setSelectedHubId}
              required
            />

            <div className="space-y-4">
              {/* Input mode toggle + active panel */}
              <div className="space-y-4">

                {/* Pill toggle */}
                <div className="bg-white border border-gray-200 rounded-xl p-1.5 flex gap-1" role="tablist">
                  <button
                    role="tab"
                    aria-selected={inputMode === "manual"}
                    onClick={() => switchInputMode("manual")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      inputMode === "manual"
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
                    role="tab"
                    aria-selected={inputMode === "csv"}
                    onClick={() => switchInputMode("csv")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      inputMode === "csv"
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

                {/* Manual entry table */}
                {inputMode === "manual" && (
                  <ManualEntryTable
                    accountId={selectedHubId ? hubs.find((h) => h.id === selectedHubId)?.accountId ?? null : null}
                    onResult={handleManualResult}
                    onProjectCached={handleProjectCached}
                    initialOps={queueOps ?? undefined}
                  />
                )}

                {/* CSV uploader */}
                {inputMode === "csv" && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <CsvUploader onResult={handleCsvResult} />
                  </div>
                )}

                {/* Operations ready summary */}
                {queueOps && queueOps.length > 0 && inputMode === "csv" && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-700">
                        {queueOps.length} operation{queueOps.length !== 1 ? "s" : ""} parsed — ready to review
                      </p>
                      <button
                        onClick={() => setQueueOps(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex gap-2 text-xs flex-wrap">
                      {(["add", "update", "remove"] as const).map((action) => {
                        const count = queueOps.filter((o) => o.action === action).length;
                        if (count === 0) return null;
                        const styles = {
                          add: "bg-green-100 text-green-700",
                          update: "bg-yellow-100 text-yellow-700",
                          remove: "bg-red-100 text-red-700",
                        };
                        const labels = { add: "+", update: "~", remove: "−" };
                        return (
                          <span key={action} className={`px-2 py-1 rounded-full ${styles[action]}`}>
                            {labels[action]} {count} {action}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Helper panels — CSV mode only, shown below the main panel */}
              {inputMode === "csv" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <ProjectLookup
                    accountId={selectedHubId ? hubs.find((h) => h.id === selectedHubId)?.accountId ?? null : null}
                    hubSelected={selectedHubId !== null}
                  />

                  <UserLookup
                    accountId={selectedHubId ? hubs.find((h) => h.id === selectedHubId)?.accountId ?? null : null}
                  />

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-3">Required columns</h3>
                    <dl className="space-y-2 text-xs">
                      <div>
                        <dt className="font-medium text-gray-700 font-mono">email</dt>
                        <dd className="text-gray-500">User email address</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-700 font-mono">role</dt>
                        <dd className="text-gray-500">ACC role: admin, member, viewer…</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-700 font-mono">project_id</dt>
                        <dd className="text-gray-500">ACC project UUID</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
                      Optional: <code className="font-mono">first_name</code>,{" "}
                      <code className="font-mono">last_name</code>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </WizardLayout>
      )}

      {/* ── Step 1: Bulk Queue ─────────────────────────────── */}
      {step === 1 && queueOps && (
        <WizardLayout
          title="Bulk Operation Queue"
          subtitle="Edit, add, or remove operations before running the dry-run preview."
          nextLabel="Preview Changes"
          onNext={() => setStep(2)}
          onBack={() => { setInputMode("manual"); setStep(0); }}
        >
          <OperationQueue operations={queueOps} projects={Object.values(projectCache)} onClear={handleClearQueue} />
        </WizardLayout>
      )}

      {/* ── Step 2: Preview Changes ────────────────────────── */}
      {step === 2 && queueOps && (
        <WizardLayout
          title="Preview Changes"
          subtitle="Validate and review what will change in each project. No changes have been made yet."
          nextLabel="Confirm &amp; Execute"
          canAdvance={!dryRunHasErrors}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        >
          <DryRunPreview
            operations={queueOps}
            onHasErrors={setDryRunHasErrors}
          />
        </WizardLayout>
      )}

      {/* ── Step 3: Execution ──────────────────────────────── */}
      {step === 3 && queueOps && (
        <WizardLayout
          title="Executing Changes"
          subtitle="Applying bulk operations to ACC. Do not close this tab."
          showNext={false}
          showBack={false}
        >
          <OperationQueue operations={queueOps} projects={Object.values(projectCache)} onClear={handleClearQueue} autoExecute />
        </WizardLayout>
      )}
    </div>
  );
}

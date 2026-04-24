"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { Hub, Project } from "@/app/lib/acc-admin";
import type { CsvOperationRow, CsvRowError } from "@/app/lib/csv-parser";
import StepNav from "@/app/components/StepNav";
import Sidebar, { type WorkflowId } from "@/app/components/Sidebar";
import { trackEvent } from "@/app/lib/analytics";
import WizardLayout from "@/app/components/WizardLayout";
import CsvUploader from "@/app/components/CsvUploader";
import OperationQueue from "@/app/components/OperationQueue";
import DryRunPreview from "@/app/components/DryRunPreview";
import HubSelector from "@/app/components/HubSelector";
import ProjectLookup from "@/app/components/ProjectLookup";
import UserLookup from "@/app/components/UserLookup";
import ManualEntryTable from "@/app/components/ManualEntryTable";
import UserImportStep from "@/app/components/UserImportStep";
import type { UserImportStepState } from "@/app/components/UserImportStep";
import UserImportResultsTable from "@/app/components/UserImportResultsTable";
import FolderPermissionStep from "@/app/components/FolderPermissionStep";
import FolderPermissionPreview from "@/app/components/FolderPermissionPreview";
import FolderPermissionResults from "@/app/components/FolderPermissionResults";
import type { FolderEntry } from "@/app/lib/folder-entry";
import type { AccountUserImportResult } from "@/app/lib/acc-admin";

interface Props {
  initialHubs: Hub[];
  initialError: string | null;
}

/** Keeps only Forma / BIM360 hubs. Falls back to all hubs if none match. */
function filterRelevantHubs(hubs: Hub[]): Hub[] {
  const relevant = hubs.filter((h) => {
    const t = h.type?.toLowerCase() ?? "";
    return t.includes("bim360") || t.includes("acc") || t.includes("forma");
  });
  return relevant.length > 0 ? relevant : hubs;
}

const WORKFLOW_STEPS: Record<WorkflowId, string[]> = {
  users: ["Import Users", "User Results"],
  permissions: ["Roles", "Preview Changes", "Role Results"],
  folders: ["Folder Permissions", "Preview Changes", "Folder Permission Results"],
};

/**
 * Dashboard — three independent workflows selectable from the left sidebar.
 *
 *   users        → Import Users  → User Results
 *   permissions  → Permissions   → Preview Changes    → Permission Results
 *   folders      → Folder Perms  → Preview Changes    → Folder Permission Results
 *
 * Switching workflows via the sidebar resets the target workflow to its
 * first step.
 */
export default function Dashboard({ initialHubs, initialError }: Props) {
  const [workflow, setWorkflow] = useState<WorkflowId>("users");
  const [usersStep, setUsersStep] = useState(0);
  const [permsStep, setPermsStep] = useState(0);
  const [foldersStep, setFoldersStep] = useState(0);

  const [queueOps, setQueueOps] = useState<CsvOperationRow[] | null>(null);
  const [error] = useState<string | null>(initialError);
  const [dryRunHasErrors, setDryRunHasErrors] = useState(false);
  const [inputMode, setInputMode] = useState<"manual" | "csv">("manual");

  const [hubs, setHubs] = useState<Hub[]>(initialHubs);

  useEffect(() => {
    if (hubs.length > 0) return;
    fetch("/api/hubs")
      .then(async (res) => {
        const data: { hubs?: Hub[]; error?: string } = await res.json();
        if (!res.ok) return;
        setHubs(data.hubs ?? []);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedHubId, setSelectedHubId] = useState<string | null>(() => {
    const relevant = filterRelevantHubs(initialHubs);
    return relevant.length === 1 ? relevant[0].id : null;
  });

  useEffect(() => {
    if (selectedHubId) return;
    const relevant = filterRelevantHubs(hubs);
    if (relevant.length === 1) setSelectedHubId(relevant[0].id);
  }, [hubs, selectedHubId]);

  const [projectCache, setProjectCache] = useState<Record<string, Project>>({});
  const handleProjectCached = useCallback((project: Project) => {
    setProjectCache((prev) => (prev[project.id] ? prev : { ...prev, [project.id]: project }));
  }, []);
  useEffect(() => {
    setProjectCache({});
  }, [selectedHubId]);

  const [userImportState, setUserImportState] = useState<UserImportStepState>({
    hasRows: false,
    running: false,
    pendingCount: 0,
    runImport: () => Promise.resolve(),
  });

  const [importResults, setImportResults] = useState<AccountUserImportResult[] | null>(null);

  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([]);

  const handleCsvResult = useCallback((ops: CsvOperationRow[], _errors: CsvRowError[]) => {
    setQueueOps(ops);
  }, []);

  const handleManualResult = useCallback((ops: CsvOperationRow[]) => {
    setQueueOps(ops.length > 0 ? ops : null);
  }, []);

  function switchInputMode(mode: "manual" | "csv") {
    setInputMode(mode);
    setQueueOps(null);
    trackEvent("input_mode_changed", { mode });
  }

  const resetPermissionsWorkflow = useCallback(() => {
    setQueueOps(null);
    setPermsStep(0);
  }, []);

  const selectWorkflow = useCallback((id: WorkflowId) => {
    setWorkflow(id);
    if (id === "users") setUsersStep(0);
    else if (id === "permissions") setPermsStep(0);
    else if (id === "folders") setFoldersStep(0);
    trackEvent("workflow_selected", { workflow: id });
  }, []);

  const relevantHubs = useMemo(() => filterRelevantHubs(hubs), [hubs]);
  const selectedHub = useMemo(
    () => hubs.find((h) => h.id === selectedHubId) ?? null,
    [hubs, selectedHubId],
  );

  const currentStep =
    workflow === "users" ? usersStep : workflow === "permissions" ? permsStep : foldersStep;

  return (
    <div className="min-h-full bg-gray-50 flex">
      <Sidebar active={workflow} onSelect={selectWorkflow} />

      <div className="flex-1 min-w-0">
        <StepNav labels={WORKFLOW_STEPS[workflow]} currentStep={currentStep} />

        {/* ══════════════════════ USERS WORKFLOW ══════════════════════ */}
        {workflow === "users" && usersStep === 0 && (() => {
          const { hasRows, running, pendingCount, runImport } = userImportState;
          const nextLabel = pendingCount > 0
            ? `Create ${pendingCount} user${pendingCount === 1 ? "" : "s"}`
            : "Create Users";
          const canAdvance = hasRows && !running;

          return (
            <WizardLayout
              title="Import Users"
              subtitle="Create new users in the Forma account."
              nextLabel={nextLabel}
              canAdvance={canAdvance}
              showBack={false}
              onNext={() => {
                void runImport();
              }}
            >
              <UserImportStep
                hubs={relevantHubs}
                selectedHubId={selectedHubId}
                onSelectHub={(id) => setSelectedHubId(id)}
                onStateChange={setUserImportState}
                onImportComplete={(results) => {
                  setImportResults(results);
                  trackEvent("step_completed", { workflow: "users", step: 0 });
                  setUsersStep(1);
                }}
              />
            </WizardLayout>
          );
        })()}

        {workflow === "users" && usersStep === 1 && (
          <WizardLayout
            title="User Results"
            subtitle="Per-row outcome of the account-user import run."
            nextLabel="Go to Roles"
            onNext={() => {
              trackEvent("step_completed", { workflow: "users", step: 1 });
              selectWorkflow("permissions");
            }}
            onBack={() => {
              trackEvent("step_back", { workflow: "users", from_step: 1, to_step: 0 });
              setUsersStep(0);
            }}
          >
            <UserImportResultsTable results={importResults ?? []} />
          </WizardLayout>
        )}

        {/* ═════════════════ PERMISSIONS WORKFLOW ═════════════════════ */}
        {workflow === "permissions" && permsStep === 0 && (
          <WizardLayout
            title="Roles"
            subtitle="Build your operation list manually or import a CSV file."
            nextLabel="Preview Changes"
            canAdvance={queueOps !== null && queueOps.length > 0 && (inputMode !== "csv" || selectedHubId !== null)}
            showBack={false}
            onNext={() => {
              trackEvent("step_completed", { workflow: "permissions", step: 0, input_mode: inputMode, operation_count: queueOps?.length ?? 0 });
              setPermsStep(1);
            }}
          >
            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <HubSelector
                hubs={relevantHubs}
                selectedHubId={selectedHubId}
                onSelect={(id) => {
                  setSelectedHubId(id);
                  const hub = hubs.find((h) => h.id === id);
                  if (hub) trackEvent("hub_selected", { hub_id: hub.id, hub_name: hub.name });
                }}
                required
              />

              <div className="space-y-4">
                <div className="space-y-4">
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

                  {inputMode === "manual" && (
                    <ManualEntryTable
                      accountId={selectedHub?.accountId ?? null}
                      onResult={handleManualResult}
                      onProjectCached={handleProjectCached}
                      initialOps={queueOps ?? undefined}
                    />
                  )}

                  {inputMode === "csv" && (
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <CsvUploader onResult={handleCsvResult} />
                    </div>
                  )}

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

                {inputMode === "csv" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <ProjectLookup
                      accountId={selectedHub?.accountId ?? null}
                      hubSelected={selectedHubId !== null}
                    />

                    <UserLookup
                      accountId={selectedHub?.accountId ?? null}
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
                          <dd className="text-gray-500">Forma role: admin, member, viewer…</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-700 font-mono">project_id</dt>
                          <dd className="text-gray-500">Forma project UUID</dd>
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

        {workflow === "permissions" && permsStep === 1 && queueOps && (
          <WizardLayout
            title="Preview Changes"
            subtitle="Validate and review what will change in each project. No changes have been made yet."
            nextLabel="Apply Roles"
            canAdvance={!dryRunHasErrors}
            onNext={() => {
              trackEvent("step_completed", { workflow: "permissions", step: 1, operation_count: queueOps?.length ?? 0 });
              setPermsStep(2);
            }}
            onBack={() => {
              trackEvent("step_back", { workflow: "permissions", from_step: 1, to_step: 0 });
              setInputMode("manual");
              setPermsStep(0);
            }}
          >
            <DryRunPreview
              operations={queueOps}
              onHasErrors={setDryRunHasErrors}
            />
          </WizardLayout>
        )}

        {workflow === "permissions" && permsStep === 2 && queueOps && (
          <WizardLayout
            title="Role Results"
            subtitle="Applying bulk operations to Forma. Do not close this tab."
            showNext={false}
            showBack={false}
          >
            <OperationQueue
              operations={queueOps}
              projects={Object.values(projectCache)}
              onClear={resetPermissionsWorkflow}
              onContinueToFolders={() => {
                trackEvent("step_completed", { workflow: "permissions", step: 2 });
                selectWorkflow("folders");
              }}
              autoExecute
            />
          </WizardLayout>
        )}

        {/* ═════════════ FOLDER PERMISSIONS WORKFLOW ═════════════════ */}
        {workflow === "folders" && foldersStep === 0 && (
          <WizardLayout
            title="Folder Permissions"
            subtitle="Grant ACC Docs folder-level permissions to project members."
            nextLabel="Preview Changes"
            canAdvance={folderEntries.length > 0 && selectedHubId !== null}
            onBack={() => {
              trackEvent("step_back", { workflow: "folders", from_step: 0, to_workflow: "permissions" });
              selectWorkflow("permissions");
            }}
            onNext={() => {
              trackEvent("step_completed", { workflow: "folders", step: 0, entry_count: folderEntries.length });
              setFoldersStep(1);
            }}
          >
            <FolderPermissionStep
              hubs={relevantHubs}
              selectedHubId={selectedHubId}
              onSelectHub={(id) => setSelectedHubId(id)}
              entries={folderEntries}
              onChangeEntries={setFolderEntries}
            />
          </WizardLayout>
        )}

        {workflow === "folders" && foldersStep === 1 && (
          <WizardLayout
            title="Preview Changes"
            subtitle="Review folder-permission grants before applying."
            nextLabel="Apply Grants"
            canAdvance={folderEntries.length > 0}
            onNext={() => {
              trackEvent("step_completed", { workflow: "folders", step: 1, entry_count: folderEntries.length });
              setFoldersStep(2);
            }}
            onBack={() => {
              trackEvent("step_back", { workflow: "folders", from_step: 1, to_step: 0 });
              setFoldersStep(0);
            }}
          >
            <FolderPermissionPreview entries={folderEntries} />
          </WizardLayout>
        )}

        {workflow === "folders" && foldersStep === 2 && (
          <WizardLayout
            title="Folder Permission Results"
            subtitle="Applying folder-permission grants. Do not close this tab."
            showNext={false}
            onBack={() => {
              trackEvent("step_back", { workflow: "folders", from_step: 2, to_step: 1 });
              setFoldersStep(1);
            }}
          >
            <FolderPermissionResults
              entries={folderEntries}
              onChangeEntries={setFolderEntries}
              accountId={selectedHub?.accountId ?? null}
              hubId={selectedHubId}
              onFinish={() => {
                trackEvent("step_completed", { workflow: "folders", step: 2 });
                setFolderEntries([]);
                setFoldersStep(0);
              }}
              autoExecute
            />
          </WizardLayout>
        )}
      </div>
    </div>
  );
}

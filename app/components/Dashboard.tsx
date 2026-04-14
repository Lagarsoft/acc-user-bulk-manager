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

interface Props {
  initialHubs: Hub[];
  initialError: string | null;
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

  // Hub selection — auto-select when only one hub is available.
  const [selectedHubId, setSelectedHubId] = useState<string | null>(
    initialHubs.length === 1 ? initialHubs[0].id : null,
  );

  // When hubs load client-side and there's only one, auto-select it.
  useEffect(() => {
    if (selectedHubId) return;
    if (hubs.length === 1) setSelectedHubId(hubs[0].id);
  }, [hubs, selectedHubId]);

  // Projects for the selected hub.
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Fetch projects whenever the selected hub changes.
  useEffect(() => {
    if (!selectedHubId) {
      setProjects([]);
      setProjectsError(null);
      return;
    }

    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);

    fetch(`/api/projects?hubId=${encodeURIComponent(selectedHubId)}`)
      .then(async (res) => {
        const data: { projects?: Project[]; error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        return data.projects ?? [];
      })
      .then((loaded) => {
        if (!cancelled) setProjects(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setProjects([]);
          setProjectsError(err instanceof Error ? err.message : "Failed to load projects");
        }
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedHubId]);

  const handleCsvResult = useCallback((ops: CsvOperationRow[], _errors: CsvRowError[]) => {
    setQueueOps(ops);
  }, []);

  const handleClearQueue = useCallback(() => {
    setQueueOps(null);
    setStep(0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <StepNav currentStep={step} />

      {/* ── Step 0: Input Data ─────────────────────────────── */}
      {step === 0 && (
        <WizardLayout
          title="Input Data"
          subtitle="Select your account, find project IDs, then upload your CSV."
          nextLabel="Continue to Queue"
          canAdvance={queueOps !== null && queueOps.length > 0}
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
              hubs={hubs}
              selectedHubId={selectedHubId}
              onSelect={setSelectedHubId}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: CSV uploader */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <CsvUploader onResult={handleCsvResult} />
                </div>

                {queueOps && queueOps.length > 0 && (
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
                          <span
                            key={action}
                            className={`px-2 py-1 rounded-full ${styles[action]}`}
                          >
                            {labels[action]} {count} {action}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right sidebar: project lookup + user lookup + column reference */}
              <div className="space-y-4">
                <ProjectLookup
                  projects={projects}
                  loading={projectsLoading}
                  error={projectsError}
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
          onBack={() => setStep(0)}
        >
          <OperationQueue operations={queueOps} projects={projects} onClear={handleClearQueue} />
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
          <OperationQueue operations={queueOps} projects={projects} onClear={handleClearQueue} />
        </WizardLayout>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import type { Hub } from "@/app/lib/acc-admin";
import type { CsvOperationRow, CsvRowError } from "@/app/lib/csv-parser";
import StepNav from "@/app/components/StepNav";
import WizardLayout from "@/app/components/WizardLayout";
import CsvUploader from "@/app/components/CsvUploader";
import OperationQueue from "@/app/components/OperationQueue";
import DryRunPreview from "@/app/components/DryRunPreview";

interface Props {
  initialHubs: Hub[];
  initialError: string | null;
}

/**
 * Dashboard — orchestrates the 4-step bulk-import wizard.
 *
 * Step 0: Upload CSV     — parse the CSV; advance when operations exist
 * Step 1: Bulk Queue     — review / edit operations; advance to dry-run
 * Step 2: Preview Changes — dry-run diff (issue #9 placeholder)
 * Step 3: Execution      — run operations (handled inside OperationQueue on step 1)
 */
export default function Dashboard({ initialHubs: _initialHubs, initialError }: Props) {
  const [step, setStep] = useState(0);
  const [queueOps, setQueueOps] = useState<CsvOperationRow[] | null>(null);
  const [error] = useState<string | null>(initialError);
  const [dryRunHasErrors, setDryRunHasErrors] = useState(false);

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

      {/* ── Step 0: Upload CSV ─────────────────────────────── */}
      {step === 0 && (
        <WizardLayout
          title="Upload CSV"
          subtitle="Import a CSV file containing the user operations to perform."
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <CsvUploader onResult={handleCsvResult} />
              </div>

              {queueOps && queueOps.length > 0 && (
                <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
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
                  <div className="flex gap-2 text-xs">
                    {["add", "update", "remove"].map((action) => {
                      const count = queueOps.filter((o) => (o as { action?: string }).action === action || action === "add").length;
                      if (action !== "add") return null;
                      return (
                        <span key={action} className="px-2 py-1 rounded-full bg-green-100 text-green-700">
                          +{count} operations
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Side panel: column reference */}
            <div className="space-y-4">
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
          <OperationQueue operations={queueOps} projects={[]} onClear={handleClearQueue} />
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
          <OperationQueue operations={queueOps} projects={[]} onClear={handleClearQueue} />
        </WizardLayout>
      )}
    </div>
  );
}

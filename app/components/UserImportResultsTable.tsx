"use client";

import type { AccountUserImportResult } from "@/app/lib/acc-admin";

interface Props {
  results: AccountUserImportResult[];
}

/**
 * UserImportResultsTable — renders the per-row outcome of the account-user
 * import run. Used by the Results wizard step in Dashboard.tsx.
 */
export default function UserImportResultsTable({ results }: Props) {
  const created = results.filter((r) => r.status === "created").length;
  const exists = results.filter((r) => r.status === "exists").length;
  const errored = results.filter((r) => r.status === "error").length;

  if (results.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
        No users were imported in this run.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 text-sm flex-wrap">
        <span className="font-medium text-gray-800">
          {results.length} user{results.length === 1 ? "" : "s"} processed
        </span>
        {created > 0 && (
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
            ✓ {created} invited
          </span>
        )}
        {exists > 0 && (
          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
            = {exists} already in account
          </span>
        )}
        {errored > 0 && (
          <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs">
            ✗ {errored} failed
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Email</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r) => (
              <tr key={r.email} className="align-top">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-800">{r.email}</td>
                <td className="px-4 py-2.5 text-xs">
                  {r.status === "created" && (
                    <span className="inline-flex items-center gap-1 text-green-700">✓ Invited</span>
                  )}
                  {r.status === "exists" && (
                    <span className="inline-flex items-center gap-1 text-gray-600">= Already in account</span>
                  )}
                  {r.status === "error" && (
                    <span className="inline-flex items-center gap-1 text-red-700">✗ Error</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">
                  {r.status === "error" ? r.message ?? "Unknown error" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
        New users receive an invite email from Autodesk and appear as{" "}
        <span className="font-medium">pending</span> until they sign in.
      </p>
    </div>
  );
}

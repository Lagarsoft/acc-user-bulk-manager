"use client";

import { useState, useMemo } from "react";
import type { Project } from "@/app/lib/acc-admin";

interface Props {
  projects: Project[];
  loading: boolean;
  hubSelected: boolean;
  error: string | null;
}

/**
 * ProjectLookup — search projects by name and copy their IDs.
 *
 * Shown in the Step 0 sidebar so users can find project IDs while
 * building their CSV without leaving the app.
 */
export default function ProjectLookup({ projects, loading, hubSelected, error }: Props) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">Find project ID</h3>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
          <span className="w-4 h-4 border-2 border-[#0696D7] border-t-transparent rounded-full animate-spin" />
          Loading projects…
        </div>
      ) : error ? (
        <p className="text-xs text-red-500 py-2">{error}</p>
      ) : !hubSelected ? (
        <p className="text-xs text-gray-400 py-2">
          Select an account above to browse projects.
        </p>
      ) : projects.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No projects found in this account.</p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0696D7] focus:border-transparent"
          />

          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 -mx-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-3 text-center">
                No projects match &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-2 px-1 py-2 hover:bg-gray-50 rounded"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {project.name}
                    </p>
                    <p className="text-xs text-gray-400 font-mono truncate">
                      {project.id}
                    </p>
                  </div>
                  <button
                    onClick={() => copyId(project.id)}
                    title="Copy project ID"
                    className="shrink-0 text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-[#0696D7] hover:text-[#0696D7] transition-colors"
                  >
                    {copiedId === project.id ? "Copied!" : "Copy ID"}
                  </button>
                </div>
              ))
            )}
          </div>

          <p className="text-xs text-gray-400">
            {filtered.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import type { Project } from "@/app/lib/acc-admin";

interface Props {
  accountId: string | null;
  hubSelected: boolean;
}

/**
 * ProjectLookup — search projects by name and copy their IDs.
 *
 * Shown in the Step 0 sidebar so users can find project IDs while
 * building their CSV without leaving the app.
 */
export default function ProjectLookup({ accountId, hubSelected }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (q: string) => {
      if (!accountId || q.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      const hubId = `b.${accountId}`;
      setLoading(true);
      setError(null);
      fetch(`/api/projects?hubId=${encodeURIComponent(hubId)}&q=${encodeURIComponent(q.trim())}`)
        .then(async (res) => {
          const data: { projects?: Project[]; error?: string } = await res.json();
          if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
          setResults(data.projects ?? []);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Search failed");
          setResults([]);
        })
        .finally(() => setLoading(false));
    },
    [accountId],
  );

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => search(value), 400);
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">Find project ID</h3>

      {!hubSelected ? (
        <p className="text-xs text-gray-400 py-2">
          Select an account above to browse projects.
        </p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0696D7] focus:border-transparent"
          />

          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2 justify-center">
              <span className="w-3 h-3 border-2 border-[#0696D7] border-t-transparent rounded-full animate-spin" />
              Searching…
            </div>
          ) : query.trim().length < 2 ? (
            <p className="text-xs text-gray-400 py-2 text-center">
              Type at least 2 characters to search.
            </p>
          ) : results.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center">
              No projects match &ldquo;{query}&rdquo;
            </p>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 -mx-1">
                {results.map((project) => (
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
                ))}
              </div>
              <p className="text-xs text-gray-400">{results.length} result{results.length !== 1 ? "s" : ""}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

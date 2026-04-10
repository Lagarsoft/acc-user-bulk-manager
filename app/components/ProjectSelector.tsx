"use client";

import type { Hub, Project } from "@/app/lib/acc-admin";

interface Props {
  hubs: Hub[];
  projects: Project[];
  selectedProjectIds: Set<string>;
  loadingProjects: boolean;
  onHubChange: (hubId: string) => void;
  onProjectToggle: (projectId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function ProjectSelector({
  hubs,
  projects,
  selectedProjectIds,
  loadingProjects,
  onHubChange,
  onProjectToggle,
  onSelectAll,
  onDeselectAll,
}: Props) {
  return (
    <div className="p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Account
      </h2>

      <select
        defaultValue=""
        onChange={(e) => onHubChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md py-1.5 px-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="" disabled>
          Select account (hub)…
        </option>
        {hubs.map((hub) => (
          <option key={hub.id} value={hub.id}>
            {hub.name}
          </option>
        ))}
      </select>

      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Projects
      </h2>

      {loadingProjects && (
        <p className="text-sm text-gray-400">Loading projects…</p>
      )}

      {!loadingProjects && projects.length === 0 && (
        <p className="text-sm text-gray-400">Select an account to list its projects.</p>
      )}

      {!loadingProjects && projects.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2 text-xs">
            <button onClick={onSelectAll} className="text-blue-600 hover:underline">
              Select all
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={onDeselectAll} className="text-blue-600 hover:underline">
              Deselect all
            </button>
            <span className="ml-auto text-gray-400">{selectedProjectIds.size} selected</span>
          </div>

          <ul className="space-y-0.5">
            {projects.map((project) => (
              <li key={project.id}>
                <label className="flex items-center gap-2 rounded px-1 py-1 cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.has(project.id)}
                    onChange={() => onProjectToggle(project.id)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-800 truncate" title={project.name}>
                    {project.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

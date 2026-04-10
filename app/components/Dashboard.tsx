"use client";

import { useState, useCallback } from "react";
import type { Hub, Project, ProjectUser } from "@/app/lib/acc-admin";
import type { CsvOperationRow, CsvRowError } from "@/app/lib/csv-parser";
import ProjectSelector from "@/app/components/ProjectSelector";
import UserTable from "@/app/components/UserTable";
import CsvUploader from "@/app/components/CsvUploader";
import OperationQueue from "@/app/components/OperationQueue";

interface Props {
  initialHubs: Hub[];
  initialError: string | null;
}

export default function Dashboard({ initialHubs, initialError }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [queueOps, setQueueOps] = useState<CsvOperationRow[] | null>(null);

  const handleHubChange = useCallback(async (hubId: string) => {
    setProjects([]);
    setSelectedProjectIds(new Set());
    setUsers([]);
    if (!hubId) return;

    setLoadingProjects(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects?hubId=${encodeURIComponent(hubId)}`);
      const data: { projects?: Project[]; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load projects");
      setProjects(data.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const handleProjectToggle = useCallback((projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleLoadUsers = useCallback(async () => {
    if (selectedProjectIds.size === 0) return;

    setLoadingUsers(true);
    setError(null);
    setUsers([]);

    try {
      const results = await Promise.all(
        [...selectedProjectIds].map(async (projectId) => {
          const res = await fetch(
            `/api/projects/${encodeURIComponent(projectId)}/users`,
          );
          const data: { users?: ProjectUser[]; error?: string } = await res.json();
          if (!res.ok) throw new Error(data.error ?? `Failed to load users for ${projectId}`);
          return data.users ?? [];
        }),
      );
      setUsers(results.flat());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }, [selectedProjectIds]);

  const handleCsvResult = useCallback((ops: CsvOperationRow[], _errors: CsvRowError[]) => {
    setQueueOps(ops);
  }, []);

  const handleRoleUpdate = useCallback(
    async (projectId: string, userId: string, role: string) => {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/users/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      const data: { user?: ProjectUser; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Role update failed");

      const updated = data.user!;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId && u.projectId === projectId
            ? { ...u, role: updated.role, roleLabel: updated.roleLabel }
            : u,
        ),
      );
    },
    [],
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">ACC User Bulk Manager</h1>
      </header>

      <div className="flex" style={{ height: "calc(100vh - 57px)" }}>
        {/* Sidebar */}
        <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <ProjectSelector
              hubs={initialHubs}
              projects={projects}
              selectedProjectIds={selectedProjectIds}
              loadingProjects={loadingProjects}
              onHubChange={handleHubChange}
              onProjectToggle={handleProjectToggle}
              onSelectAll={() => setSelectedProjectIds(new Set(projects.map((p) => p.id)))}
              onDeselectAll={() => setSelectedProjectIds(new Set())}
            />
          </div>

          {selectedProjectIds.size > 0 && (
            <div className="shrink-0 p-4 border-t border-gray-200">
              <button
                onClick={handleLoadUsers}
                disabled={loadingUsers}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingUsers
                  ? "Loading…"
                  : `Load Users (${selectedProjectIds.size} project${selectedProjectIds.size !== 1 ? "s" : ""})`}
              </button>
            </div>
          )}
        </aside>

        {/* Main content */}
        <section className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <UserTable
            users={users}
            projects={projects}
            onRoleUpdate={handleRoleUpdate}
          />

          {/* Bulk Import */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Bulk Import via CSV</h2>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              {queueOps === null ? (
                <CsvUploader onResult={handleCsvResult} />
              ) : (
                <OperationQueue
                  operations={queueOps}
                  projects={projects}
                  onClear={() => setQueueOps(null)}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

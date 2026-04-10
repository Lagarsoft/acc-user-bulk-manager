"use client";

import { useState, useMemo } from "react";
import type { Project, ProjectUser } from "@/app/lib/acc-admin";

// Role options mirrored from acc-admin ROLE_LABELS (no server import needed client-side).
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "admin", label: "Administrator" },
  { value: "member", label: "Member" },
  { value: "project_admin", label: "Project Admin" },
  { value: "project_manager", label: "Project Manager" },
  { value: "gc_foreman", label: "GC Foreman" },
  { value: "gc_manager", label: "GC Manager" },
  { value: "owner", label: "Owner" },
  { value: "executive", label: "Executive" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

type SortField = "email" | "firstName" | "lastName" | "roleLabel" | "project";
type SortDir = "asc" | "desc";

interface Props {
  users: ProjectUser[];
  projects: Project[];
  onRoleUpdate: (projectId: string, userId: string, role: string) => Promise<void>;
}

export default function UserTable({ users, projects, onRoleUpdate }: Props) {
  const [sortField, setSortField] = useState<SortField>("email");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState("");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function sortArrow(field: SortField) {
    if (field !== sortField) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const project = projectNames[u.projectId] ?? u.projectId;
      return (
        u.email.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.roleLabel.toLowerCase().includes(q) ||
        project.toLowerCase().includes(q)
      );
    });
  }, [users, filter, projectNames]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av =
        sortField === "project"
          ? (projectNames[a.projectId] ?? a.projectId)
          : (a[sortField] as string);
      const bv =
        sortField === "project"
          ? (projectNames[b.projectId] ?? b.projectId)
          : (b[sortField] as string);
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir, projectNames]);

  async function handleRoleChange(user: ProjectUser, newRole: string) {
    const key = `${user.projectId}:${user.id}`;
    setUpdatingKey(key);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      await onRoleUpdate(user.projectId, user.id, newRole);
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Update failed",
      }));
    } finally {
      setUpdatingKey(null);
    }
  }

  if (users.length === 0) {
    return (
      <div className="mt-16 text-center text-sm text-gray-400">
        Select projects and click "Load Users" to populate the table.
      </div>
    );
  }

  const thClass =
    "px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:bg-gray-100";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Filter by email, name, role, or project…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-[200px] max-w-sm border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-aps-blue"
        />
        <span className="text-sm text-gray-400">
          {sorted.length} of {users.length} user{users.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass} onClick={() => toggleSort("email")}>
                  Email {sortArrow("email")}
                </th>
                <th className={thClass} onClick={() => toggleSort("firstName")}>
                  First Name {sortArrow("firstName")}
                </th>
                <th className={thClass} onClick={() => toggleSort("lastName")}>
                  Last Name {sortArrow("lastName")}
                </th>
                <th className={thClass} onClick={() => toggleSort("roleLabel")}>
                  Role {sortArrow("roleLabel")}
                </th>
                <th className={thClass} onClick={() => toggleSort("project")}>
                  Project {sortArrow("project")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sorted.map((user) => {
                const key = `${user.projectId}:${user.id}`;
                const isUpdating = updatingKey === key;
                const rowError = rowErrors[key];
                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{user.email}</td>
                    <td className="px-4 py-3 text-gray-700">{user.firstName}</td>
                    <td className="px-4 py-3 text-gray-700">{user.lastName}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        disabled={isUpdating}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-aps-blue disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        {/* Keep unknown roles selectable if returned by API */}
                        {!ROLE_OPTIONS.some((o) => o.value === user.role) && (
                          <option value={user.role}>{user.roleLabel}</option>
                        )}
                      </select>
                      {rowError && (
                        <p className="mt-1 text-xs text-red-600">{rowError}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {projectNames[user.projectId] ?? user.projectId}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

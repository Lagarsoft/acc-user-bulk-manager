"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { AccRole, AccountUser } from "@/app/lib/acc-admin";
import type { CsvOperationRow, CsvAction } from "@/app/lib/csv-parser";

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const ROLES: { value: AccRole; label: string }[] = [
  { value: "member",          label: "Member" },
  { value: "admin",           label: "Admin" },
  { value: "project_admin",   label: "Project Admin" },
  { value: "project_manager", label: "Project Manager" },
  { value: "executive",       label: "Executive" },
  { value: "editor",          label: "Editor" },
  { value: "viewer",          label: "Viewer" },
  { value: "gc_foreman",      label: "GC Foreman" },
  { value: "gc_manager",      label: "GC Manager" },
  { value: "owner",           label: "Owner" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface ManualRow {
  id: number;
  action: CsvAction;
  email: string;
  role: AccRole;
  projectId: string;
  firstName: string;
  lastName: string;
}

interface Props {
  accountId: string | null;
  onResult: (ops: CsvOperationRow[]) => void;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

let nextRowId = 1;

export default function ManualEntryTable({ accountId, onResult }: Props) {
  const [rows, setRows] = useState<ManualRow[]>([]);

  // User picker
  const [openUserPicker, setOpenUserPicker] = useState<number | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<AccountUser[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const userDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close user picker when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenUserPicker(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Emit valid rows upward on every change
  useEffect(() => {
    const ops: CsvOperationRow[] = rows
      .filter((r) => {
        if (!EMAIL_RE.test(r.email)) return false;
        if (!r.projectId.trim()) return false;
        if (r.action !== "remove" && !r.role) return false;
        return true;
      })
      .map((r, i) => ({
        rowNumber: i + 2,
        action: r.action,
        projectId: r.projectId.trim(),
        email: r.email,
        role: r.role,
        firstName: r.firstName,
        lastName: r.lastName,
      }));
    onResult(ops);
  }, [rows, onResult]);

  // --------------------------------------------------------------------------
  // Row mutations
  // --------------------------------------------------------------------------

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: nextRowId++, action: "add", email: "", role: "member", projectId: "", firstName: "", lastName: "" },
    ]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (openUserPicker === id) setOpenUserPicker(null);
  }

  function updateRow(id: number, patch: Partial<ManualRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // --------------------------------------------------------------------------
  // User picker
  // --------------------------------------------------------------------------

  const fetchUsers = useCallback(
    (query: string) => {
      if (!accountId || query.trim().length < 2) {
        setUserResults([]);
        setUserLoading(false);
        return;
      }
      setUserLoading(true);
      fetch(`/api/users?accountId=${encodeURIComponent(accountId)}&q=${encodeURIComponent(query.trim())}`)
        .then(async (res) => {
          const data: { users?: AccountUser[]; error?: string } = await res.json();
          if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
          setUserResults(data.users ?? []);
        })
        .catch(() => setUserResults([]))
        .finally(() => setUserLoading(false));
    },
    [accountId],
  );

  function openUserPickerFor(rowId: number, currentEmail: string) {
    setOpenUserPicker(rowId);
    setUserQuery(currentEmail);
    setUserResults([]);
  }

  function handleUserQueryChange(rowId: number, value: string) {
    updateRow(rowId, { email: value });
    setUserQuery(value);
    if (userDebounceRef.current) clearTimeout(userDebounceRef.current);
    userDebounceRef.current = setTimeout(() => fetchUsers(value), 400);
  }

  function pickUser(rowId: number, user: AccountUser) {
    updateRow(rowId, {
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
    });
    setOpenUserPicker(null);
    setUserResults([]);
    setUserQuery("");
  }

  // --------------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------------

  function rowIsValid(r: ManualRow): boolean {
    if (!EMAIL_RE.test(r.email)) return false;
    if (!r.projectId.trim()) return false;
    if (r.action !== "remove" && !r.role) return false;
    return true;
  }

  const validCount = rows.filter(rowIsValid).length;

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div ref={containerRef} className="bg-white border border-gray-200 rounded-xl overflow-visible">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Operation list</span>
        <span className="text-xs text-gray-400">
          {validCount > 0
            ? `${validCount} of ${rows.length} row${rows.length !== 1 ? "s" : ""} ready`
            : rows.length > 0
              ? `${rows.length} row${rows.length !== 1 ? "s" : ""} — fill required fields`
              : "No rows yet"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[580px]">
          <colgroup>
            <col className="w-28" />
            <col />
            <col className="w-32" />
            <col className="w-48" />
            <col className="w-8" />
          </colgroup>
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="py-2 px-4 text-left font-medium">Action</th>
              <th className="py-2 px-4 text-left font-medium">Email</th>
              <th className="py-2 px-4 text-left font-medium">Role</th>
              <th className="py-2 px-4 text-left font-medium">Project ID</th>
              <th className="py-2 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-gray-400">
                  No operations yet — click <strong>Add row</strong> below to start.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="align-top">
                  {/* Action */}
                  <td className="px-3 py-2.5">
                    <select
                      value={row.action}
                      onChange={(e) => {
                        const action = e.target.value as CsvAction;
                        updateRow(row.id, {
                          action,
                          role: action === "remove" ? ("" as AccRole) : row.role || "member",
                        });
                      }}
                      className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0696D7]"
                    >
                      <option value="add">+ Add</option>
                      <option value="update">~ Update</option>
                      <option value="remove">− Remove</option>
                    </select>
                  </td>

                  {/* Email + user picker */}
                  <td className="px-3 py-2.5">
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="user@example.com"
                        value={row.email}
                        onChange={(e) => handleUserQueryChange(row.id, e.target.value)}
                        onFocus={() => openUserPickerFor(row.id, row.email)}
                        className={`text-xs border rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#0696D7] ${
                          row.email && !EMAIL_RE.test(row.email)
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300"
                        }`}
                      />
                      {openUserPicker === row.id && (
                        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                          {!accountId ? (
                            <p className="text-xs text-gray-400 px-3 py-3">
                              Select an account to search users.
                            </p>
                          ) : userQuery.trim().length < 2 ? (
                            <p className="text-xs text-gray-400 px-3 py-3">
                              Type at least 2 characters to search.
                            </p>
                          ) : userLoading ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-400">
                              <span className="w-3 h-3 border-2 border-[#0696D7] border-t-transparent rounded-full animate-spin" />
                              Searching…
                            </div>
                          ) : userResults.length === 0 ? (
                            <p className="text-xs text-gray-400 px-3 py-3 text-center">
                              No users found
                            </p>
                          ) : (
                            <div className="max-h-44 overflow-y-auto divide-y divide-gray-100">
                              {userResults.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    pickUser(row.id, u);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-[#E6F4FB] transition-colors"
                                >
                                  <p className="text-xs font-medium text-gray-800 truncate">
                                    {u.name || `${u.firstName} ${u.lastName}`.trim() || u.email}
                                  </p>
                                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-3 py-2.5">
                    <select
                      value={row.role}
                      disabled={row.action === "remove"}
                      onChange={(e) => updateRow(row.id, { role: e.target.value as AccRole })}
                      className={`text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white w-full focus:outline-none focus:ring-2 focus:ring-[#0696D7] ${
                        row.action === "remove" ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Project ID — plain paste input */}
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      placeholder="Paste project ID…"
                      value={row.projectId}
                      onChange={(e) => updateRow(row.id, { projectId: e.target.value })}
                      className="text-xs border border-gray-300 rounded-md px-2 py-1.5 w-full font-mono focus:outline-none focus:ring-2 focus:ring-[#0696D7]"
                    />
                  </td>

                  {/* Delete */}
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label="Remove row"
                      className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="px-4 py-2.5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={addRow}
                  className="text-xs text-[#0696D7] hover:text-[#0580BC] flex items-center gap-1.5 font-medium transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Add row
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

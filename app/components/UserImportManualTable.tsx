"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UserImportRow } from "@/app/lib/user-csv-parser";

interface ManualUserRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  phone: string;
  industry: string;
}

interface Props {
  accountId: string | null;
  onChange: (rows: UserImportRow[]) => void;
  initialRows?: UserImportRow[];
  disabled?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let nextRowId = 1;

function blankRow(): ManualUserRow {
  return {
    id: nextRowId++,
    email: "",
    firstName: "",
    lastName: "",
    company: "",
    jobTitle: "",
    phone: "",
    industry: "",
  };
}

/**
 * UserImportManualTable — free-form table for entering account users by hand.
 *
 * Visual patterns mirror ManualEntryTable.tsx (table-fixed + colgroup,
 * count-in-header, Add-row in tfoot, SVG delete icon).
 *
 * Emits only valid rows (valid email, non-duplicate) via `onChange`.
 */
export default function UserImportManualTable({
  accountId,
  onChange,
  initialRows,
  disabled,
}: Props) {
  const [rows, setRows] = useState<ManualUserRow[]>(() => {
    if (!initialRows || initialRows.length === 0) return [];
    return initialRows.map((r) => ({
      id: nextRowId++,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      company: r.company,
      jobTitle: r.jobTitle,
      phone: r.phone,
      industry: r.industry,
    }));
  });

  const duplicateEmails = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = r.email.trim().toLowerCase();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [k, n] of counts) if (n > 1) dups.add(k);
    return dups;
  }, [rows]);

  const validRows = useMemo(() => {
    const seen = new Set<string>();
    const out: UserImportRow[] = [];
    rows.forEach((r, idx) => {
      const email = r.email.trim();
      if (!EMAIL_RE.test(email)) return;
      const key = email.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        rowNumber: idx + 1,
        email,
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        company: r.company.trim(),
        jobTitle: r.jobTitle.trim(),
        phone: r.phone.trim(),
        industry: r.industry.trim(),
      });
    });
    return out;
  }, [rows]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current(validRows);
  }, [validRows]);

  function updateRow(id: number, patch: Partial<ManualUserRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const validCount = validRows.length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-visible">
      {/* Header with count — mirrors ManualEntryTable */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">User list</span>
        <span className="text-xs text-gray-400">
          {validCount > 0
            ? `${validCount} of ${rows.length} row${rows.length !== 1 ? "s" : ""} ready`
            : rows.length > 0
              ? `${rows.length} row${rows.length !== 1 ? "s" : ""} — fill a valid email`
              : "No rows yet"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed min-w-[900px]">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-10" />
          </colgroup>
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="py-2 px-4 text-left font-medium">Email</th>
              <th className="py-2 px-4 text-left font-medium">First name</th>
              <th className="py-2 px-4 text-left font-medium">Last name</th>
              <th className="py-2 px-4 text-left font-medium">Company</th>
              <th className="py-2 px-4 text-left font-medium">Job title</th>
              <th className="py-2 px-4 text-left font-medium">Phone</th>
              <th className="py-2 px-4 text-left font-medium">Industry</th>
              <th className="py-2 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-gray-400">
                  {!accountId
                    ? "Select an account above to start adding users."
                    : <>No users yet — click <strong>Add user</strong> below to start.</>}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const emailTrim = row.email.trim();
                const emailInvalid = emailTrim !== "" && !EMAIL_RE.test(emailTrim);
                const isDuplicate = !emailInvalid && duplicateEmails.has(emailTrim.toLowerCase());
                const emailHasError = emailInvalid || isDuplicate;
                return (
                  <tr key={row.id} className="align-top">
                    {/* Email */}
                    <td className="px-3 py-2.5">
                      <input
                        type="email"
                        placeholder="user@example.com"
                        value={row.email}
                        disabled={disabled}
                        onChange={(e) => updateRow(row.id, { email: e.target.value })}
                        className={`text-xs border rounded-md px-2 py-1.5 w-full font-mono focus:outline-none focus:ring-2 focus:ring-[#0696D7] disabled:bg-gray-50 ${
                          emailHasError ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                        aria-invalid={emailHasError}
                        title={isDuplicate ? "Duplicate email — only the first row will be used" : undefined}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <TextCell value={row.firstName} disabled={disabled} onChange={(v) => updateRow(row.id, { firstName: v })} />
                    </td>
                    <td className="px-3 py-2.5">
                      <TextCell value={row.lastName} disabled={disabled} onChange={(v) => updateRow(row.id, { lastName: v })} />
                    </td>
                    <td className="px-3 py-2.5">
                      <TextCell value={row.company} disabled={disabled} onChange={(v) => updateRow(row.id, { company: v })} />
                    </td>
                    <td className="px-3 py-2.5">
                      <TextCell value={row.jobTitle} disabled={disabled} onChange={(v) => updateRow(row.id, { jobTitle: v })} />
                    </td>
                    <td className="px-3 py-2.5">
                      <TextCell value={row.phone} disabled={disabled} onChange={(v) => updateRow(row.id, { phone: v })} />
                    </td>
                    <td className="px-3 py-2.5">
                      <TextCell value={row.industry} disabled={disabled} onChange={(v) => updateRow(row.id, { industry: v })} />
                    </td>
                    <td className="px-1 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={disabled}
                        aria-label="Remove row"
                        className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded disabled:opacity-40"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8} className="px-4 py-2.5 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addRow}
                    disabled={!accountId || disabled}
                    className="text-xs flex items-center gap-1.5 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-[#0696D7] hover:text-[#0580BC] disabled:hover:text-[#0696D7]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Add user
                  </button>
                  {!accountId && (
                    <div className="relative group">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 cursor-default" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                        Select an account above to add users
                        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  )}
                  <span className="ml-auto text-[11px] text-gray-400">
                    Only <span className="font-mono text-gray-500">email</span> is required.
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TextCell({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      placeholder="Optional"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-gray-300 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#0696D7] disabled:bg-gray-50"
    />
  );
}

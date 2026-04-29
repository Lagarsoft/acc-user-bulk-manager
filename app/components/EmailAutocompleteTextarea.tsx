"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectUser } from "@/app/lib/acc-admin";

interface Props {
  projectId: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

/**
 * Splits the textarea content into (prefix, currentToken). The current token
 * is the substring after the last separator — what the user is actively
 * typing at the end.
 */
function splitLastToken(value: string): { prefix: string; token: string } {
  const match = value.match(/[\s,;]+(?!.*[\s,;])/);
  if (!match || match.index === undefined) {
    return { prefix: "", token: value };
  }
  const splitAt = match.index + match[0].length;
  return { prefix: value.slice(0, splitAt), token: value.slice(splitAt) };
}

export default function EmailAutocompleteTextarea({
  projectId,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
}: Props) {
  const [members, setMembers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const requestIdRef = useRef(0);

  // Fetch the project's member list once per projectId. We keep the whole list
  // in memory and filter locally — project rosters are small enough that this
  // beats round-tripping a search endpoint on every keystroke.
  useEffect(() => {
    setMembers([]);
    setLoadError(null);
    if (!projectId) return;

    const reqId = ++requestIdRef.current;
    setLoading(true);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/users`)
      .then(async (res) => {
        const data: { users?: ProjectUser[]; error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (reqId !== requestIdRef.current) return;
        setMembers(data.users ?? []);
      })
      .catch((err) => {
        if (reqId !== requestIdRef.current) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load project users");
        setMembers([]);
      })
      .finally(() => {
        if (reqId === requestIdRef.current) setLoading(false);
      });
  }, [projectId]);

  const { token } = useMemo(() => splitLastToken(value), [value]);
  const trimmedToken = token.trim().toLowerCase();

  // Admins (project or account) already have full folder access via role
  // inheritance — Autodesk refuses explicit grants on them. Hide from
  // suggestions so users can't pick them.
  const grantable = useMemo(
    () => members.filter((u) => !u.isProjectAdmin && !u.isAccountAdmin),
    [members],
  );
  const hiddenAdminCount = members.length - grantable.length;

  const suggestions = useMemo(() => {
    if (!projectId) return [];
    if (trimmedToken.length === 0) return grantable.slice(0, 20);
    return grantable
      .filter((u) => {
        const email = u.email.toLowerCase();
        const fullName = `${u.firstName} ${u.lastName}`.trim().toLowerCase();
        return email.includes(trimmedToken) || fullName.includes(trimmedToken);
      })
      .slice(0, 20);
  }, [projectId, grantable, trimmedToken]);

  useEffect(() => {
    setHighlight(0);
  }, [suggestions.length]);

  function pick(user: ProjectUser) {
    const { prefix } = splitLastToken(value);
    const next = `${prefix}${user.email}, `;
    onChange(next);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      const choice = suggestions[highlight];
      if (choice) {
        e.preventDefault();
        pick(choice);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown =
    open && !!projectId && (loading || suggestions.length > 0 || !!loadError);

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a mouseDown on a suggestion can register before close.
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0696D7]"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
          {loading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-[#0696D7] border-t-transparent rounded-full animate-spin" />
              Loading project users…
            </div>
          )}
          {!loading && loadError && suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs text-red-500">{loadError}</div>
          )}
          {!loading && !loadError && suggestions.length === 0 && grantable.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">
              {members.length === 0
                ? "This project has no members yet."
                : "Every project member is an admin — admins already have full folder access, so there is no one to grant."}
            </div>
          )}
          {suggestions.map((user, idx) => {
            const isActive = idx === highlight;
            const display =
              `${user.firstName} ${user.lastName}`.trim() || user.email;
            return (
              <button
                key={user.id || user.email}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus on textarea
                  pick(user);
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`w-full text-left px-3 py-2 text-sm flex flex-col gap-0.5 ${
                  isActive ? "bg-[#0696D7]/10" : "hover:bg-gray-50"
                }`}
              >
                <span className="text-gray-800 truncate">{display}</span>
                <span className="text-xs text-gray-500 truncate">{user.email}</span>
                {user.roleLabels.length > 0 && (
                  <span className="text-xs text-gray-300 truncate">{user.roleLabels.join(", ")}</span>
                )}
              </button>
            );
          })}
          {!loading && hiddenAdminCount > 0 && (
            <div className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100 bg-gray-50">
              {hiddenAdminCount} admin{hiddenAdminCount === 1 ? "" : "s"} hidden — they already
              have full folder access.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

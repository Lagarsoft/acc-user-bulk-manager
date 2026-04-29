"use client";

import { useState, useRef, useEffect } from "react";
import type { AccRole, ProjectRole } from "@/app/lib/acc-admin";

interface Props {
  selected: AccRole[];
  availableRoles: ProjectRole[];
  loading: boolean;
  disabled: boolean;
  onChange: (roles: AccRole[]) => void;
}

export default function RoleMultiSelect({ selected, availableRoles, loading, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(roleName: string) {
    const key = roleName.toLowerCase() as AccRole;
    const next = selected.includes(key)
      ? selected.filter((r) => r !== key)
      : [...selected, key];
    onChange(next);
  }

  const label =
    loading
      ? "Loading…"
      : disabled && availableRoles.length === 0
        ? "Select a project first"
        : selected.length === 0
          ? "Select roles…"
          : selected.join(", ");

  const isDisabled = disabled || loading || (!loading && availableRoles.length === 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setOpen((o) => !o)}
        className={`text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white w-full text-left flex items-center justify-between gap-1 focus:outline-none focus:ring-2 focus:ring-[#0696D7] ${
          isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        } ${selected.length === 0 && !isDisabled ? "text-gray-400" : "text-gray-700"}`}
      >
        <span className="truncate">{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !isDisabled && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[160px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {availableRoles.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-3">No roles available</p>
          ) : (
            <div className="max-h-52 overflow-y-auto py-1">
              {availableRoles.map((r) => {
                const key = r.name.toLowerCase() as AccRole;
                const checked = selected.includes(key);
                return (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#E6F4FB] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.name)}
                      className="accent-[#0696D7] w-3.5 h-3.5 shrink-0"
                    />
                    <span className="text-xs text-gray-700 truncate">{r.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

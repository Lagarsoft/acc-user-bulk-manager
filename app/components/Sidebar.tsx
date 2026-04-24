"use client";

import type { ReactNode } from "react";

export type WorkflowId = "users" | "permissions" | "folders";

interface Props {
  active: WorkflowId;
  onSelect: (id: WorkflowId) => void;
}

interface Item {
  id: WorkflowId;
  label: string;
  description: string;
  icon: ReactNode;
}

const ITEMS: Item[] = [
  {
    id: "users",
    label: "Import Users",
    description: "Create account users",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  {
    id: "permissions",
    label: "Roles",
    description: "Project roles",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "folders",
    label: "Folder Permissions",
    description: "ACC Docs folders",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    ),
  },
];

export default function Sidebar({ active, onSelect }: Props) {
  return (
    <aside
      className="w-56 shrink-0 bg-white border-r border-gray-200 sticky top-0 h-[calc(100vh-3.5rem)] overflow-y-auto hidden md:block"
      aria-label="Workflow navigation"
    >
      <nav className="p-3 space-y-1">
        <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Workflows
        </p>
        {ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                isActive
                  ? "bg-[#0696D7]/10 text-[#0696D7]"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className={`mt-0.5 ${isActive ? "text-[#0696D7]" : "text-gray-400"}`}>
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className={`block text-xs ${isActive ? "text-[#0696D7]/80" : "text-gray-400"}`}>
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

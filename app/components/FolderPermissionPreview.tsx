"use client";

import { useMemo } from "react";
import type { FolderEntry } from "@/app/lib/folder-entry";
import {
  PERMISSION_LEVEL_LABELS,
  type PermissionLevel,
} from "@/app/lib/folder-permission-levels";

interface Props {
  entries: FolderEntry[];
}

interface Group {
  key: string;
  projectId: string;
  projectName?: string;
  folderPath: string;
  counts: Record<PermissionLevel, number>;
  total: number;
  emails: string[];
}

/**
 * Read-only preview grouped by (project, folder) with permission breakdown.
 * No API calls — just a summary of what will be executed in the next step.
 */
export default function FolderPermissionPreview({ entries }: Props) {
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const e of entries) {
      const key = `${e.projectId}::${e.folderPath}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          projectId: e.projectId,
          projectName: e.projectName,
          folderPath: e.folderPath,
          counts: { viewer: 0, downloader: 0, uploader: 0, editor: 0, manager: 0 },
          total: 0,
          emails: [],
        });
      }
      const g = map.get(key)!;
      g.counts[e.permission] += 1;
      g.total += 1;
      g.emails.push(e.email);
    }
    return Array.from(map.values());
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        No grants queued yet. Go back and add some first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SummaryCard label="Grants" value={entries.length} />
          <SummaryCard
            label="Projects"
            value={new Set(entries.map((e) => e.projectId)).size}
          />
          <SummaryCard
            label="Folders"
            value={new Set(entries.map((e) => `${e.projectId}::${e.folderPath}`)).size}
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-700">
            {groups.length} folder{groups.length === 1 ? "" : "s"} affected
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Project</th>
              <th className="text-left px-4 py-2 font-medium">Folder</th>
              <th className="text-left px-4 py-2 font-medium">Grants</th>
              <th className="text-left px-4 py-2 font-medium">Breakdown</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map((g) => (
              <tr key={g.key}>
                <td className="px-4 py-3 align-top">
                  <div className="truncate max-w-[12rem]" title={g.projectId}>
                    {g.projectName ?? g.projectId}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-mono text-xs truncate max-w-[18rem]" title={g.folderPath}>
                    {g.folderPath}
                  </div>
                </td>
                <td className="px-4 py-3 align-top tabular-nums text-gray-700">{g.total}</td>
                <td className="px-4 py-3 align-top">
                  <div className="flex gap-1 flex-wrap">
                    {(Object.keys(g.counts) as PermissionLevel[]).map((level) => {
                      const n = g.counts[level];
                      if (n === 0) return null;
                      return (
                        <span
                          key={level}
                          className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                        >
                          {PERMISSION_LEVEL_LABELS[level]} · {n}
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="text-xl font-semibold text-gray-800 tabular-nums">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

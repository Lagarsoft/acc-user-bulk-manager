"use client";

import { useCallback, useEffect, useState } from "react";
import type { FolderNode } from "@/app/lib/folder-permission-levels";

interface Props {
  hubId: string;
  projectId: string;
  /** Called when the user clicks a folder; receives the folder URN and its path. */
  onPick: (folder: { id: string; path: string }) => void;
  /** Currently selected folder URN — used to highlight. */
  selectedId?: string | null;
}

interface TreeState {
  loading: boolean;
  error: string | null;
  folders: FolderNode[];
}

/**
 * FolderTreePicker — lazy-loaded folder browser.
 *
 * Renders the project's top-level folders and expands children on click.
 * Used in the Folder Permissions manual-entry mode.
 */
export default function FolderTreePicker({ hubId, projectId, onPick, selectedId }: Props) {
  const [tree, setTree] = useState<Record<string, TreeState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const TOP_KEY = "__top__";

  const loadFolder = useCallback(
    async (key: string, url: string) => {
      setTree((prev) => ({ ...prev, [key]: { loading: true, error: null, folders: prev[key]?.folders ?? [] } }));
      try {
        const res = await fetch(url);
        const data: { folders?: FolderNode[]; error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setTree((prev) => ({
          ...prev,
          [key]: { loading: false, error: null, folders: data.folders ?? [] },
        }));
      } catch (err) {
        setTree((prev) => ({
          ...prev,
          [key]: {
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load folders",
            folders: [],
          },
        }));
      }
    },
    [],
  );

  // Load top folders on mount / project change.
  useEffect(() => {
    setTree({});
    setExpanded(new Set());
    if (!hubId || !projectId) return;
    const url = `/api/projects/${encodeURIComponent(projectId)}/folders?hubId=${encodeURIComponent(hubId)}`;
    void loadFolder(TOP_KEY, url);
  }, [hubId, projectId, loadFolder]);

  function toggle(folder: FolderNode, parentPath: string) {
    const key = folder.id;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!tree[key]) {
          const url = `/api/projects/${encodeURIComponent(projectId)}/folders?parent=${encodeURIComponent(folder.id)}`;
          void loadFolder(key, url);
        }
      }
      return next;
    });
    const path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
    onPick({ id: folder.id, path });
  }

  const topState = tree[TOP_KEY];

  function renderFolders(folders: FolderNode[], parentPath: string, depth: number) {
    return (
      <ul className={depth === 0 ? "" : "pl-4 border-l border-gray-100 ml-2"}>
        {folders.map((f) => {
          const isOpen = expanded.has(f.id);
          const state = tree[f.id];
          const isSelected = selectedId === f.id;
          const path = parentPath ? `${parentPath}/${f.name}` : f.name;
          return (
            <li key={f.id} className="py-0.5">
              <button
                onClick={() => toggle(f, parentPath)}
                className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-50 flex items-center gap-2 ${
                  isSelected ? "bg-[#0696D7]/10 text-[#0696D7] font-medium" : "text-gray-700"
                }`}
                title={path}
              >
                <span className="w-4 text-xs text-gray-400">{isOpen ? "▾" : "▸"}</span>
                <span className="truncate">{f.name}</span>
              </button>
              {isOpen && (
                <>
                  {state?.loading && (
                    <p className="pl-7 py-1 text-xs text-gray-400">Loading…</p>
                  )}
                  {state?.error && (
                    <p className="pl-7 py-1 text-xs text-red-500">{state.error}</p>
                  )}
                  {state?.folders && state.folders.length > 0 && renderFolders(state.folders, path, depth + 1)}
                  {state && !state.loading && !state.error && state.folders.length === 0 && (
                    <p className="pl-7 py-1 text-xs text-gray-400">No subfolders</p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (!hubId || !projectId) {
    return (
      <div className="p-3 text-xs text-gray-400">
        Select a project first to browse folders.
      </div>
    );
  }

  if (topState?.loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-gray-400">
        <span className="w-3 h-3 border-2 border-[#0696D7] border-t-transparent rounded-full animate-spin" />
        Loading folders…
      </div>
    );
  }

  if (topState?.error) {
    return <p className="p-3 text-xs text-red-500">{topState.error}</p>;
  }

  if (!topState || topState.folders.length === 0) {
    return <p className="p-3 text-xs text-gray-400">No folders available.</p>;
  }

  return <div className="max-h-96 overflow-y-auto">{renderFolders(topState.folders, "", 0)}</div>;
}

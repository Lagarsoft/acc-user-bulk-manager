"use client";

import { useRef, useState } from "react";
import type { Hub, Project } from "@/app/lib/acc-admin";
import type {
  FolderOperationRow,
  FolderCsvRowError,
} from "@/app/lib/folder-csv-parser";
import {
  PERMISSION_LEVEL_LABELS,
  type PermissionLevel,
} from "@/app/lib/folder-permission-levels";
import { type FolderEntry, newFolderEntryId } from "@/app/lib/folder-entry";
import { trackEvent } from "@/app/lib/analytics";
import HubSelector from "@/app/components/HubSelector";
import FolderTreePicker from "@/app/components/FolderTreePicker";
import EmailAutocompleteTextarea from "@/app/components/EmailAutocompleteTextarea";

/**
 * FolderPermissionStep — step 1/3 of the Folder Permissions workflow.
 *
 * Builds a queue of pending grants. Entries are lifted to the parent so the
 * Preview and Results sub-steps can operate on the same list.
 */

const PERMISSION_ORDER: PermissionLevel[] = [
  "viewer",
  "downloader",
  "uploader",
  "editor",
  "manager",
];

interface Props {
  hubs: Hub[];
  selectedHubId: string | null;
  onSelectHub: (id: string) => void;
  entries: FolderEntry[];
  onChangeEntries: (entries: FolderEntry[]) => void;
}

type Mode = "manual" | "csv";

export default function FolderPermissionStep({
  hubs,
  selectedHubId,
  onSelectHub,
  entries,
  onChangeEntries,
}: Props) {
  const [mode, setMode] = useState<Mode>("manual");
  const [topError, setTopError] = useState<string | null>(null);

  const selectedHub = hubs.find((h) => h.id === selectedHubId);
  const accountId = selectedHub?.accountId ?? null;

  // Manual form state
  const [pickedProject, setPickedProject] = useState<Project | null>(null);
  const [pickedFolder, setPickedFolder] = useState<{ id: string; path: string } | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [permissionInput, setPermissionInput] = useState<PermissionLevel>("viewer");
  const [addError, setAddError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    onChangeEntries([]);
    setTopError(null);
    setAddError(null);
    trackEvent("folder_permission_mode_changed", { mode: next });
  }

  function addManualEntry() {
    setAddError(null);
    if (!pickedProject) {
      setAddError("Pick a project first.");
      return;
    }
    if (!pickedFolder) {
      setAddError("Pick a folder first.");
      return;
    }
    const emails = emailInput
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    if (emails.length === 0) {
      setAddError("Enter at least one email.");
      return;
    }
    const additions: FolderEntry[] = emails.map((email) => ({
      id: newFolderEntryId(),
      email,
      projectId: pickedProject.id,
      projectName: pickedProject.name,
      folderPath: pickedFolder.path,
      folderUrn: pickedFolder.id,
      permission: permissionInput,
    }));
    onChangeEntries([...entries, ...additions]);
    setEmailInput("");
  }

  function removeEntry(id: string) {
    onChangeEntries(entries.filter((e) => e.id !== id));
  }

  function updateEntryPermission(id: string, permission: PermissionLevel) {
    onChangeEntries(entries.map((e) => (e.id === id ? { ...e, permission } : e)));
  }

  // CSV upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleCsvFile(file: File) {
    setTopError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/csv/import-folders", { method: "POST", body: fd });
      const data: {
        operations?: FolderOperationRow[];
        errors?: FolderCsvRowError[];
        error?: string;
      } = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const imported = (data.operations ?? []).map<FolderEntry>((op) => ({
        id: newFolderEntryId(),
        email: op.email,
        projectId: op.projectId,
        folderPath: op.folderPath,
        permission: op.permission,
      }));
      onChangeEntries(imported);

      if (data.errors && data.errors.length > 0) {
        setTopError(
          `${data.errors.length} row${data.errors.length === 1 ? "" : "s"} skipped — ${data.errors
            .slice(0, 3)
            .map((e) => `row ${e.rowNumber}: ${e.message}`)
            .join("; ")}${data.errors.length > 3 ? "…" : ""}`,
        );
      }
      trackEvent("folder_permission_csv_imported", {
        ok: imported.length,
        errors: data.errors?.length ?? 0,
      });
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "CSV import failed");
    }
  }

  return (
    <div className="space-y-4">
      <HubSelector
        hubs={hubs}
        selectedHubId={selectedHubId}
        onSelect={(id) => {
          onSelectHub(id);
          setPickedProject(null);
          setPickedFolder(null);
        }}
        required
      />

      {/* Mode toggle */}
      <div className="bg-white border border-gray-200 rounded-xl p-1.5 flex gap-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          onClick={() => switchMode("manual")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            mode === "manual"
              ? "bg-[#0696D7] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          Build Manually
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "csv"}
          onClick={() => switchMode("csv")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            mode === "csv"
              ? "bg-[#0696D7] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          Upload CSV
        </button>
      </div>

      {/* Manual builder */}
      {mode === "manual" && selectedHubId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ManualProjectFolderPicker
            hubId={selectedHubId}
            accountId={accountId}
            pickedProject={pickedProject}
            onPickProject={(p) => {
              setPickedProject(p);
              setPickedFolder(null);
            }}
            pickedFolder={pickedFolder}
            onPickFolder={setPickedFolder}
          />

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 h-fit">
            <h3 className="text-sm font-semibold">Add grants</h3>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Emails</label>
              <EmailAutocompleteTextarea
                projectId={pickedProject?.id ?? null}
                value={emailInput}
                onChange={setEmailInput}
                placeholder={
                  pickedProject
                    ? "alice@example.com, bob@example.com"
                    : "Pick a project to load its members…"
                }
                rows={3}
                disabled={!pickedProject}
              />
              <p className="text-xs text-gray-400 mt-1">
                {pickedProject
                  ? "Only members of the selected project are suggested. Separate multiple with commas, spaces, or newlines."
                  : "Pick a project first — folder permissions can only be granted to project members."}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Permission</label>
              <select
                value={permissionInput}
                onChange={(e) => setPermissionInput(e.target.value as PermissionLevel)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {PERMISSION_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PERMISSION_LEVEL_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            {pickedProject && pickedFolder && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-2">
                <div className="truncate">
                  <span className="font-medium text-gray-700">Project:</span> {pickedProject.name}
                </div>
                <div className="truncate">
                  <span className="font-medium text-gray-700">Folder:</span> {pickedFolder.path}
                </div>
              </div>
            )}
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            <button
              type="button"
              onClick={addManualEntry}
              className="w-full bg-[#0696D7] hover:bg-[#0580BC] text-white text-sm font-medium py-2 rounded-lg"
            >
              Add to queue
            </button>
          </div>
        </div>
      )}

      {/* CSV upload */}
      {mode === "csv" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">Upload folder-permissions CSV</h3>
          <p className="text-xs text-gray-500 mb-3">
            Required columns: <code className="font-mono">email</code>,{" "}
            <code className="font-mono">project_id</code>,{" "}
            <code className="font-mono">folder_path</code>,{" "}
            <code className="font-mono">permission</code>.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCsvFile(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#0696D7] file:text-white hover:file:bg-[#0580BC]"
          />
        </div>
      )}

      {/* Entries table */}
      {entries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {entries.length} grant{entries.length === 1 ? "" : "s"} queued
            </p>
            <button
              type="button"
              onClick={() => onChangeEntries([])}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear all
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Project</th>
                <th className="text-left px-4 py-2 font-medium">Folder</th>
                <th className="text-left px-4 py-2 font-medium">Permission</th>
                <th className="w-8 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.id} className="text-sm">
                  <td className="px-4 py-2 truncate max-w-[14rem]">{e.email}</td>
                  <td className="px-4 py-2 truncate max-w-[12rem]" title={e.projectId}>
                    {e.projectName ?? e.projectId}
                  </td>
                  <td className="px-4 py-2 truncate max-w-[16rem]" title={e.folderPath}>
                    {e.folderPath}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={e.permission}
                      onChange={(ev) => updateEntryPermission(e.id, ev.target.value as PermissionLevel)}
                      className="border border-gray-200 rounded-md px-2 py-1 text-xs"
                    >
                      {PERMISSION_ORDER.map((p) => (
                        <option key={p} value={p}>
                          {PERMISSION_LEVEL_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeEntry(e.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                      title="Remove row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {topError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {topError}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Manual project + folder picker (self-contained)
// --------------------------------------------------------------------------

interface PickerProps {
  hubId: string;
  accountId: string | null;
  pickedProject: Project | null;
  onPickProject: (p: Project | null) => void;
  pickedFolder: { id: string; path: string } | null;
  onPickFolder: (f: { id: string; path: string }) => void;
}

function ManualProjectFolderPicker({
  hubId,
  accountId,
  pickedProject,
  onPickProject,
  pickedFolder,
  onPickFolder,
}: PickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Project[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!accountId || value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      fetch(`/api/projects?hubId=${encodeURIComponent(hubId)}&q=${encodeURIComponent(value.trim())}`)
        .then(async (res) => {
          const data: { projects?: Project[]; error?: string } = await res.json();
          if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
          setResults(data.projects ?? []);
        })
        .catch((err) => setSearchError(err instanceof Error ? err.message : "Search failed"))
        .finally(() => setSearching(false));
    }, 400);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold">Pick a project &amp; folder</h3>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Project</label>
        {pickedProject ? (
          <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm truncate">{pickedProject.name}</p>
              <p className="text-xs text-gray-400 font-mono truncate">{pickedProject.id}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onPickProject(null);
                setQuery("");
                setResults([]);
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by name…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            {searchError && <p className="text-xs text-red-500 mt-1">{searchError}</p>}
            {searching && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-[#0696D7] border-t-transparent rounded-full animate-spin" />
                Searching…
              </p>
            )}
            {!searching && results.length > 0 && (
              <div className="border border-gray-200 rounded-lg mt-2 max-h-48 overflow-y-auto divide-y divide-gray-100">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPickProject(p)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  >
                    <p className="text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{p.id}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {pickedProject && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">Folder</label>
          <div className="border border-gray-200 rounded-lg">
            <FolderTreePicker
              hubId={hubId}
              projectId={pickedProject.id}
              onPick={onPickFolder}
              selectedId={pickedFolder?.id ?? null}
            />
          </div>
          {pickedFolder && (
            <p className="text-xs text-gray-500 mt-2 font-mono truncate" title={pickedFolder.path}>
              {pickedFolder.path}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

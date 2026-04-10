"use client";

import { useState, useRef, useCallback } from "react";
import type { CsvOperationRow, CsvRowError } from "@/app/lib/csv-parser";

interface Props {
  onResult: (operations: CsvOperationRow[], errors: CsvRowError[]) => void;
}

const SAMPLE_CSV =
  "email,project_id,action,role,first_name,last_name\n" +
  "alice@example.com,b.proj.00000000-0000-0000-0000-000000000001,add,member,Alice,Smith\n" +
  "bob@example.com,b.proj.00000000-0000-0000-0000-000000000001,update,project_admin,Bob,Jones\n" +
  "carol@example.com,b.proj.00000000-0000-0000-0000-000000000001,remove,,,\n";

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CsvUploader({ onResult }: Props) {
  const [uploading, setUploading] = useState(false);
  const [parseErrors, setParseErrors] = useState<CsvRowError[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [actionCounts, setActionCounts] = useState<{ add: number; update: number; remove: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setParseErrors([]);
    setActionCounts(null);
    setFileName(file.name);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/csv/import", { method: "POST", body });
      const data: { operations?: CsvOperationRow[]; errors?: CsvRowError[]; error?: string } =
        await res.json();

      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const operations = data.operations ?? [];
      const errors = data.errors ?? [];

      setParseErrors(errors);

      if (operations.length > 0) {
        const counts = { add: 0, update: 0, remove: 0 };
        for (const op of operations) counts[op.action]++;
        setActionCounts(counts);
        onResult(operations, errors);
      }
    } catch (err) {
      setParseErrors([
        {
          rowNumber: 0,
          field: "upload",
          message: err instanceof Error ? err.message : "Upload failed",
        },
      ]);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, []);

  return (
    <div>
      {/* Column reference */}
      <p className="text-xs text-gray-500 mb-3">
        Required columns:{" "}
        <code className="font-mono">email</code>, <code className="font-mono">project_id</code>.{" "}
        <code className="font-mono">action</code> (<code className="font-mono">add</code> /{" "}
        <code className="font-mono">update</code> / <code className="font-mono">remove</code>,
        defaults to <code className="font-mono">add</code>).{" "}
        <code className="font-mono">role</code> required for add/update.{" "}
        <code className="font-mono">first_name</code>, <code className="font-mono">last_name</code>{" "}
        optional.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
          dragOver
            ? "border-aps-blue bg-aps-light text-aps-blue"
            : "border-gray-300 bg-white text-gray-400 hover:border-aps-blue hover:text-aps-blue",
        ].join(" ")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <div className="text-sm text-center">
          {uploading ? (
            <span>Parsing…</span>
          ) : fileName ? (
            <span className="font-medium text-gray-700">{fileName}</span>
          ) : (
            <>
              <span className="font-medium">Drop a CSV file here</span>
              <span className="text-gray-400"> or click to browse</span>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      {/* Action counts shown after a successful parse */}
      {actionCounts && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          {actionCounts.add > 0 && (
            <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-green-100 text-green-700">
              +{actionCounts.add} add
            </span>
          )}
          {actionCounts.update > 0 && (
            <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-yellow-100 text-yellow-700">
              ~{actionCounts.update} update
            </span>
          )}
          {actionCounts.remove > 0 && (
            <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-red-100 text-red-700">
              -{actionCounts.remove} remove
            </span>
          )}
        </div>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <ul className="mt-3 space-y-1">
          {parseErrors.map((e, i) => (
            <li key={i} className="text-xs text-red-600">
              {e.rowNumber > 0 ? `Row ${e.rowNumber} · ${e.field}: ` : ""}
              {e.message}
            </li>
          ))}
        </ul>
      )}

      {/* Download sample */}
      <div className="mt-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            downloadSample();
          }}
          className="text-xs text-aps-blue hover:underline"
        >
          Download sample.csv
        </button>
      </div>
    </div>
  );
}

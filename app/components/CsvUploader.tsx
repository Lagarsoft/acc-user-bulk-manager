"use client";

import { useState, useRef } from "react";
import type { CsvOperationRow, CsvRowError } from "@/app/lib/csv-parser";

interface Props {
  onResult: (operations: CsvOperationRow[], errors: CsvRowError[]) => void;
}

export default function CsvUploader({ onResult }: Props) {
  const [uploading, setUploading] = useState(false);
  const [parseErrors, setParseErrors] = useState<CsvRowError[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setParseErrors([]);

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

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Upload a CSV with columns: <code className="font-mono">email</code>,{" "}
        <code className="font-mono">role</code>,{" "}
        <code className="font-mono">project_id</code> (required) and{" "}
        <code className="font-mono">first_name</code>,{" "}
        <code className="font-mono">last_name</code> (optional).
      </p>

      <div className="flex items-center gap-3">
        <label className="cursor-pointer flex-1">
          <span className="block border border-dashed border-gray-300 rounded-md px-3 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 truncate">
            {fileName ?? "Choose CSV file…"}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setFileName(f?.name ?? null);
              setParseErrors([]);
            }}
          />
        </label>

        <button
          onClick={handleUpload}
          disabled={uploading || !fileName}
          className="shrink-0 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Parsing…" : "Parse CSV"}
        </button>
      </div>

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
    </div>
  );
}

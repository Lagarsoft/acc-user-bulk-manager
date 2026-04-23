"use client";

import { useCallback, useRef, useState } from "react";
import type { UserImportRow } from "@/app/lib/user-csv-parser";
import type { CsvRowError } from "@/app/lib/csv-parser";
import { trackEvent } from "@/app/lib/analytics";

interface Props {
  onResult: (users: UserImportRow[], errors: CsvRowError[]) => void;
}

const SAMPLE_CSV =
  "email,first_name,last_name,company,job_title,phone,industry\n" +
  "alice@example.com,Alice,Anderson,Acme,Project Manager,+1-555-0100,Construction\n" +
  "bob@example.com,,,,,,\n" +
  "carol@example.com,Carol,Chen,Carol Co,,,Architecture\n";

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-users.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function UserImportCsvUploader({ onResult }: Props) {
  const [uploading, setUploading] = useState(false);
  const [parseErrors, setParseErrors] = useState<CsvRowError[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setParseErrors([]);
    setUserCount(null);
    setFileName(file.name);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/csv/import-users", { method: "POST", body });
      const data: { users?: UserImportRow[]; errors?: CsvRowError[]; error?: string } =
        await res.json();

      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const users = data.users ?? [];
      const errors = data.errors ?? [];

      setParseErrors(errors);
      setUserCount(users.length);

      trackEvent("user_csv_uploaded", {
        row_count: users.length,
        error_count: errors.length,
      });
      onResult(users, errors);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setParseErrors([{ rowNumber: 0, field: "upload", message }]);
      trackEvent("user_csv_parse_failed", { error_count: 1 });
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
      <p className="text-xs text-gray-500 mb-3">
        Required column: <code className="font-mono">email</code>. Optional:{" "}
        <code className="font-mono">first_name</code>, <code className="font-mono">last_name</code>,{" "}
        <code className="font-mono">company</code>, <code className="font-mono">job_title</code>,{" "}
        <code className="font-mono">phone</code>, <code className="font-mono">industry</code>.
      </p>

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
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
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
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFileChange} />
      </div>

      {userCount !== null && userCount > 0 && (
        <p className="mt-3 text-xs font-medium text-green-700">
          ✓ {userCount} user row{userCount === 1 ? "" : "s"} parsed
        </p>
      )}

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

      <div className="mt-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            downloadSample();
          }}
          className="text-xs text-aps-blue hover:underline"
        >
          Download sample-users.csv
        </button>
      </div>
    </div>
  );
}

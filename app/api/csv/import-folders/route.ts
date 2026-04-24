import { NextRequest, NextResponse } from "next/server";
import { parseFolderCsv } from "@/app/lib/folder-csv-parser";

/**
 * POST /api/csv/import-folders
 *
 * Parses a folder-permission CSV and returns a validated operation queue.
 * Required columns: email, project_id, folder_path, permission.
 *
 * Accepts multipart/form-data (field "file") or raw text/csv.
 *
 * Response 200:
 *   { operations: FolderOperationRow[], errors: FolderCsvRowError[] }
 */

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let csvText: string;

  if (contentType.startsWith("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Failed to parse multipart form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'multipart/form-data request must include a "file" field' },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "CSV file exceeds the 10 MB limit" }, { status: 413 });
    }

    csvText = await file.text();
  } else if (contentType.startsWith("text/csv") || contentType.startsWith("application/octet-stream")) {
    const buffer = await req.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "CSV file exceeds the 10 MB limit" }, { status: 413 });
    }
    csvText = new TextDecoder().decode(buffer);
  } else {
    return NextResponse.json(
      {
        error:
          'Unsupported content type. Send multipart/form-data with a "file" field, or set Content-Type: text/csv',
      },
      { status: 415 },
    );
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
  }

  const result = parseFolderCsv(csvText);
  return NextResponse.json(result);
}

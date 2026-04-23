import { NextRequest, NextResponse } from "next/server";
import { parseUserCsv } from "@/app/lib/user-csv-parser";

/**
 * POST /api/csv/import-users
 *
 * Parses a CSV for the Import Users wizard step.
 * Required column: email
 * Optional columns: first_name, last_name, company, job_title, phone, industry
 *
 * Accepts:
 *   multipart/form-data with a "file" field (max 10 MB)
 *   text/csv raw body
 *
 * Response 200:
 *   { users: UserImportRow[], errors: CsvRowError[] }
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

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

  const result = parseUserCsv(csvText);
  return NextResponse.json(result);
}

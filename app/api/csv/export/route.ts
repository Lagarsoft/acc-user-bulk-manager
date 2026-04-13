import { NextRequest } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listProjectUsers } from "@/app/lib/acc-admin";

/**
 * GET /api/csv/export?projectIds=id1,id2[&role=viewer]
 *
 * Streams a CSV snapshot of all users across the requested projects.
 *
 * Query parameters:
 *   projectIds  (required) Comma-separated list of ACC project UUIDs
 *   role        (optional) Only include users with this role (case-insensitive)
 *
 * Response 200:
 *   text/csv stream with columns:
 *     project, email, first_name, last_name, role, status
 *
 * Response 400:
 *   { error: string }
 *
 * Response 500:
 *   { error: string }
 *
 * The response uses a chunked ReadableStream so that large exports do not
 * require buffering the full result set in memory before sending.
 * Projects that cannot be fetched (e.g. missing permissions) are silently
 * skipped — rows for other projects continue to stream normally.
 */

const CSV_HEADER = ["project", "email", "first_name", "last_name", "role", "status"];

/** Wraps a field in quotes when required by RFC 4180. */
function csvField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(",") + "\r\n";
}

export async function GET(req: NextRequest) {
  const projectIdsParam = req.nextUrl.searchParams.get("projectIds");

  if (!projectIdsParam) {
    return Response.json(
      { error: "projectIds query parameter is required" },
      { status: 400 },
    );
  }

  const projectIds = projectIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (projectIds.length === 0) {
    return Response.json(
      { error: "projectIds must contain at least one project ID" },
      { status: 400 },
    );
  }

  const roleFilter = req.nextUrl.searchParams.get("role")?.toLowerCase() ?? null;

  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(csvRow(CSV_HEADER)));

      for (const projectId of projectIds) {
        let users;
        try {
          users = await listProjectUsers(projectId, token);
        } catch {
          // Skip projects that are inaccessible and continue exporting others.
          continue;
        }

        for (const user of users) {
          if (roleFilter && user.role.toLowerCase() !== roleFilter) continue;

          controller.enqueue(
            encoder.encode(
              csvRow([
                projectId,
                user.email,
                user.firstName,
                user.lastName,
                user.role,
                user.status,
              ]),
            ),
          );
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="users-export.csv"',
    },
  });
}

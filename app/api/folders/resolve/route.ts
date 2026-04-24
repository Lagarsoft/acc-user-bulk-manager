import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { resolveFolderPath, type FolderNode } from "@/app/lib/folder-permissions";

/**
 * POST /api/folders/resolve
 *
 * Resolves one or more human-readable folder paths (e.g. "Project Files/Design/Current")
 * to folder URNs by walking the Data Management folder tree.
 *
 * Request body:
 *   { hubId: string, projectId: string, paths: string[] }
 *
 * Response 200:
 *   { resolved: Record<string, string | null> }     // path → URN (or null if not found)
 *
 * Requires 3-legged token (data:read).
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { hubId?: string; projectId?: string; paths?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { hubId, projectId, paths } = body;
  if (!hubId || !projectId || !Array.isArray(paths)) {
    return NextResponse.json(
      { error: "hubId, projectId, and paths[] are required" },
      { status: 400 },
    );
  }

  try {
    const cache = new Map<string, FolderNode[]>();
    const unique = Array.from(new Set(paths));
    const entries = await Promise.all(
      unique.map(async (p) => {
        try {
          const urn = await resolveFolderPath(hubId, projectId, p, token, cache);
          return [p, urn] as const;
        } catch (err) {
          console.error("[/api/folders/resolve] error for %s:", p, err);
          return [p, null] as const;
        }
      }),
    );
    const resolved: Record<string, string | null> = {};
    for (const [path, urn] of entries) resolved[path] = urn;
    return NextResponse.json({ resolved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

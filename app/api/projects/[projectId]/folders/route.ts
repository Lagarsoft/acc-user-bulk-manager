import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listTopFolders, listFolderChildren } from "@/app/lib/folder-permissions";

/**
 * GET /api/projects/:projectId/folders?hubId=...&parent=...
 *
 * - With no `parent`: returns the top-level folders for the project.
 *   Requires `hubId`.
 * - With `parent`: returns the immediate folder children of the given folder URN.
 *
 * Response 200:
 *   { folders: FolderNode[] }
 *
 * Requires 3-legged token (data:read).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const token = req.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { projectId } = await params;
  const parent = req.nextUrl.searchParams.get("parent");
  const hubId = req.nextUrl.searchParams.get("hubId");

  try {
    if (parent) {
      const folders = await listFolderChildren(projectId, parent, token);
      return NextResponse.json({ folders });
    }
    if (!hubId) {
      return NextResponse.json(
        { error: "hubId query parameter is required when listing top folders" },
        { status: 400 },
      );
    }
    const folders = await listTopFolders(hubId, projectId, token);
    return NextResponse.json({ folders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

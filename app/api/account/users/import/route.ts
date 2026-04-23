import { NextRequest, NextResponse } from "next/server";
import { getTwoLeggedToken } from "@/app/lib/aps-auth";
import {
  createAccountUsers,
  findAccountUserByEmail,
  type AccountRegion,
  type AccountUserImportResult,
  type CreateAccountUserInput,
} from "@/app/lib/acc-admin";

/**
 * POST /api/account/users/import
 *
 * Ensures every email in the request either already exists in the Forma account
 * or is created via the /hq/v1 bulk-import endpoint (which also triggers the
 * invite email for brand-new Autodesk identities).
 *
 * Request body:
 *   {
 *     accountId: string,
 *     region?: "US" | "EMEA",            // default US
 *     users: Array<{
 *       email: string,
 *       firstName?: string,
 *       lastName?: string,
 *       company?: string,
 *       jobTitle?: string,
 *       phone?: string,
 *       industry?: string,
 *     }>
 *   }
 *
 * Response 200:
 *   {
 *     results: Array<{
 *       email: string,
 *       status: "exists" | "created" | "error",
 *       userId?: string,
 *       message?: string,
 *     }>
 *   }
 *
 * Requires Custom Integration activation on the Forma account — otherwise the
 * /hq/v1 call returns 401 and every missing-user row is returned with status
 * "error".
 */

const BULK_BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  let body: {
    accountId?: string;
    region?: AccountRegion;
    users?: CreateAccountUserInput[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { accountId, region, users } = body;
  if (!accountId || !Array.isArray(users) || users.length === 0) {
    return NextResponse.json(
      { error: "accountId and a non-empty users[] are required" },
      { status: 400 },
    );
  }

  const invalid = users.find((u) => !u?.email);
  if (invalid) {
    return NextResponse.json(
      { error: "Every user entry must include an email" },
      { status: 400 },
    );
  }

  try {
    const token = await getTwoLeggedToken();

    // Step 1 — existence check per email (parallel).
    const checks = await Promise.all(
      users.map(async (u) => ({
        input: u,
        existing: await findAccountUserByEmail(accountId, u.email, token).catch((err) => {
          console.error("[/api/account/users/import] existence check failed for %s:", u.email, err);
          return null;
        }),
      })),
    );

    const results: AccountUserImportResult[] = new Array(users.length);
    const toCreate: Array<{ idx: number; input: CreateAccountUserInput }> = [];

    checks.forEach(({ input, existing }, idx) => {
      if (existing) {
        results[idx] = { email: input.email, status: "exists", userId: existing.id };
      } else {
        toCreate.push({ idx, input });
      }
    });

    // Step 2 — bulk create in chunks of BULK_BATCH_SIZE.
    for (let offset = 0; offset < toCreate.length; offset += BULK_BATCH_SIZE) {
      const batch = toCreate.slice(offset, offset + BULK_BATCH_SIZE);
      const batchResults = await createAccountUsers(
        accountId,
        batch.map((b) => b.input),
        token,
        region ?? "US",
      );
      batchResults.forEach((r, j) => {
        const globalIdx = batch[j].idx;
        results[globalIdx] = r;
      });
    }

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

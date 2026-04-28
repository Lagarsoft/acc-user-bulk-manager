/**
 * Playwright globalSetup — runs once before all browser tests.
 *
 * Responsibilities:
 *   1. Load .env.local into the process (so APS credentials are available)
 *   2. Get a 2-legged APS token
 *   3. Discover the account ID
 *   4. Create a fresh test project named "E2E Test <timestamp>"
 *   5. Write the test state to e2e/.test-state.json so spec files can read it
 *
 * The test project is archived by globalTeardown after all tests finish.
 */

import type { FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { getTwoLeggedToken, discoverAccountId, createTestProject } from "./helpers/aps-api";

const STATE_FILE = path.join(__dirname, ".test-state.json");

function loadEnvLocal(): void {
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  loadEnvLocal();

  console.log("\n[E2E globalSetup] Acquiring 2-legged token…");
  const token = await getTwoLeggedToken();

  console.log("[E2E globalSetup] Discovering account ID…");
  const accountId = await discoverAccountId(token);
  console.log("[E2E globalSetup] accountId =", accountId);

  // Allow skipping project creation by providing a pre-existing project.
  // The APS app must be provisioned in the ACC account (Account Admin →
  // Apps & Integrations) to create projects via API. If it isn't, set these
  // two env vars in .env.local and the setup will reuse the existing project.
  let projectId: string;
  let projectName: string;

  if (process.env.APS_TEST_PROJECT_ID && process.env.APS_TEST_PROJECT_NAME) {
    projectId = process.env.APS_TEST_PROJECT_ID;
    projectName = process.env.APS_TEST_PROJECT_NAME;
    console.log("[E2E globalSetup] Using pre-existing project:", projectName, "(", projectId, ")");
  } else {
    projectName = `E2E Test ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;
    console.log("[E2E globalSetup] Creating test project:", projectName);
    try {
      projectId = await createTestProject(accountId, projectName, token);
    } catch (err) {
      throw new Error(
        [
          `createTestProject failed: ${(err as Error).message}`,
          "",
          "The APS app may not be provisioned in the ACC account.",
          "Fix option 1 — Provision the app:",
          "  acc.autodesk.com → Account Admin → Apps & Integrations → add your APS app",
          "",
          "Fix option 2 — Reuse a pre-existing project:",
          "  Add to .env.local:",
          "    APS_TEST_PROJECT_ID=<project-uuid-without-b.-prefix>",
          "    APS_TEST_PROJECT_NAME=<project-name>",
          "  Find the ID in: acc.autodesk.com → select project → copy UUID from URL",
        ].join("\n")
      );
    }
    console.log("[E2E globalSetup] projectId =", projectId);
  }

  const state = {
    accountId,
    hubId: `b.${accountId}`,
    projectId,
    projectName,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log("[E2E globalSetup] State written to", STATE_FILE, "\n");
}

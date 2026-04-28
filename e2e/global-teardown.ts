/**
 * Playwright globalTeardown — runs once after all browser tests complete.
 *
 * Archives the test project created in globalSetup so it no longer appears
 * in the account's active project list. Deletes the local state file.
 */

import type { FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { getTwoLeggedToken, archiveProject } from "./helpers/aps-api";

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

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  loadEnvLocal();

  if (!fs.existsSync(STATE_FILE)) {
    console.log("[E2E globalTeardown] No state file — nothing to clean up.");
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as {
    accountId: string;
    projectId: string;
    projectName: string;
  };

  // Skip archiving if the project was pre-existing (set via env var)
  if (process.env.APS_TEST_PROJECT_ID) {
    console.log("[E2E globalTeardown] Pre-existing project — skipping archive.");
  } else {
    console.log("\n[E2E globalTeardown] Archiving test project:", state.projectName, state.projectId);
    try {
      const token = await getTwoLeggedToken();
      await archiveProject(state.accountId, state.projectId, token);
      console.log("[E2E globalTeardown] Project archived.");
    } catch (err) {
      console.warn("[E2E globalTeardown] Failed to archive project:", err);
    }
  }

  fs.unlinkSync(STATE_FILE);
  console.log("[E2E globalTeardown] State file removed.\n");
}

/**
 * Reads the shared state written by globalSetup (e2e/.test-state.json).
 * Throws if the file is absent so test failures are clear.
 */
import * as fs from "fs";
import * as path from "path";

export interface TestState {
  accountId: string;
  hubId: string;
  projectId: string;
  projectName: string;
  createdAt: string;
}

export function readTestState(): TestState {
  const file = path.join(__dirname, "..", ".test-state.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      "e2e/.test-state.json not found — run `npx playwright test` which triggers globalSetup first."
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as TestState;
}

/** Test users used across all real-world E2E specs. */
export const TEST_USERS = [
  "julio.sarachaga@gmail.com",
  "julio.sarachaga@lagarsoft.com",
  "julillosamaral@gmail.com",
] as const;

export const TEST_COMPANY = "Testing";

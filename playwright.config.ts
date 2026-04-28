import { defineConfig, devices } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Load .env.local so all test workers have access to APS_* env vars.
// (globalSetup runs in a separate process — its env mutations don't propagate.)
const envFile = path.join(__dirname, ".env.local");
if (fs.existsSync(envFile)) {
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

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // real tests share a project — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  timeout: 60_000,

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    // Extra time for APS API responses which can be slow
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Auth setup: runs once, saves session to e2e/.auth/user.json
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Real-world tests: need auth session + the test project from globalSetup
    {
      name: "real",
      testDir: "./e2e/real",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },
    // Smoke tests (no live auth required — test structure only)
    {
      name: "smoke",
      testDir: "./e2e",
      testIgnore: ["**/real/**", "**/auth.setup.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

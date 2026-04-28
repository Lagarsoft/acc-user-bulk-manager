/**
 * Real-world E2E: Import Users workflow
 *
 * Flow:
 *   Sidebar → "Import Users" → upload CSV with 3 test emails → "Create Users"
 *   → Results table shows success/created rows
 *
 * API verification (2-legged):
 *   For each test email, call the account users search API and confirm the
 *   user exists (status "active" or "pending").
 *
 * Note: If a user already exists the import API returns "success" (idempotent),
 * so this test is safe to run multiple times.
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getTwoLeggedToken, waitForAccountUser } from "../helpers/aps-api";
import { readTestState, TEST_USERS, type TestState } from "../helpers/test-state";

// Build a CSV with the 3 test users
function makeCsv(): string {
  const header = "email,first_name,last_name,company";
  const rows = [
    `${TEST_USERS[0]},Julio,Sarachaga,Lagarsoft`,
    `${TEST_USERS[1]},Julio,Sarachaga,Lagarsoft`,
    `${TEST_USERS[2]},Juanillo,Samaral,Lagarsoft`,
  ];
  return [header, ...rows].join("\n");
}

function writeCsv(content: string): string {
  const p = path.join(os.tmpdir(), `e2e-user-import-${Date.now()}.csv`);
  fs.writeFileSync(p, content, "utf8");
  return p;
}

test.describe("01 — Import Users", () => {
  let token: string;
  let state: TestState;

  test.beforeAll(async () => {
    state = readTestState();
    token = await getTwoLeggedToken();
  });

  test("CSV import creates 3 account users and shows results table", async ({ page }) => {
    await page.goto("/");

    // --- Step 0: ensure "Import Users" workflow is active ---
    await page.getByRole("button", { name: "Import Users" }).click();

    // Switch to CSV mode
    await page.getByRole("tab", { name: /upload csv/i }).click();

    // Upload the CSV file
    const csvPath = writeCsv(makeCsv());
    await page.setInputFiles('input[type="file"]', csvPath);
    fs.unlinkSync(csvPath);

    // Wait for the CSV to be parsed — the parse summary says "3 user rows parsed"
    await expect(page.getByText(/3 user rows parsed/i)).toBeVisible({ timeout: 15_000 });

    // Click "Create Users" — scope to main to avoid matching sidebar nav button
    await page.locator("main").getByRole("button", { name: /create \d+ users/i }).click();

    // Step 1: results table
    await expect(page.getByText(/user results/i)).toBeVisible({ timeout: 30_000 });

    // Each test email should appear in the results
    for (const email of TEST_USERS) {
      await expect(page.getByText(email)).toBeVisible();
    }

    // No error rows (all should be created or already exists)
    const errorBadges = page.locator("text=/error/i");
    const errorCount = await errorBadges.count();
    expect(errorCount).toBe(0);
  });

  test("API: all 3 test users now exist in the account", async () => {
    for (const email of TEST_USERS) {
      const user = await waitForAccountUser(state.accountId, email, token, 20_000);
      expect(user.email.toLowerCase()).toBe(email.toLowerCase());
      expect(["active", "pending"]).toContain(user.status);
    }
  });
});

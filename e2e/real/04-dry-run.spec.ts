/**
 * Real-world E2E: Dry-run (Preview Changes) validation
 *
 * Precondition: test 02 ran → all 3 test users are project members.
 *
 * Tests the dry-run preview step covers all three result kinds:
 *
 *   1. add   + user already exists   → warning  "will update their role"
 *   2. update + user does NOT exist  → error    "User not found"
 *   3. remove + user does NOT exist  → warning  "no effect"
 *   4. add   + user does NOT exist   → valid    (clean add)
 *
 * None of the operations are applied — the test navigates away before
 * clicking "Apply Roles".
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { readTestState, TEST_USERS, type TestState } from "../helpers/test-state";

// julio.sarachaga@gmail.com is already a project member (from test 02)
const EXISTING_USER = TEST_USERS[0];
// A fresh address that will never be in the project
const NONEXISTENT_USER = `e2e-nonexistent-${Date.now()}@example.com`;

function makeDryRunCsv(projectId: string): string {
  return [
    "email,project_id,role,action",
    // Should warn: user already exists
    `${EXISTING_USER},${projectId},member,add`,
    // Should error: user not found for update
    `${NONEXISTENT_USER},${projectId},member,update`,
    // Should warn: user not found for remove (no-op)
    `${NONEXISTENT_USER},${projectId},,remove`,
  ].join("\n");
}

function writeCsv(content: string): string {
  const p = path.join(os.tmpdir(), `e2e-dryrun-${Date.now()}.csv`);
  fs.writeFileSync(p, content, "utf8");
  return p;
}

test.describe("04 — Dry-run preview", () => {
  let state: TestState;
  test.beforeAll(() => { state = readTestState(); });

  test("shows correct error, warning, and valid rows without applying", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Roles" }).click();

    // CSV mode
    await page.getByRole("tab", { name: /upload csv/i }).click();

    const csvPath = writeCsv(makeDryRunCsv(state.projectId));
    await page.setInputFiles('input[type="file"]', csvPath);
    fs.unlinkSync(csvPath);

    // Wait for parse summary
    await expect(page.locator("text=/add|update|remove/i").first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /preview changes/i }).click();

    // Wait for dry-run results
    await expect(
      page.getByText(/validation passed|error.*fix before|validated successfully/i)
    ).toBeVisible({ timeout: 30_000 });

    // Error row: "update" on non-existent user
    await expect(page.getByText(/user not found in this project.*cannot update/i)).toBeVisible();

    // Warning row: "add" on existing user
    await expect(page.getByText(/already exists.*will update/i)).toBeVisible();

    // Warning row: "remove" on non-existent user
    await expect(page.getByText(/not found.*no effect/i)).toBeVisible();

    // "Apply Roles" button is DISABLED because there is at least one error
    const applyBtn = page.getByRole("button", { name: /apply roles/i });
    await expect(applyBtn).toBeDisabled();
  });

  test("shows all-clear when all operations are valid adds", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Roles" }).click();
    await page.getByRole("tab", { name: /upload csv/i }).click();

    // One row: add a user that doesn't exist → no errors, no warnings
    const freshEmail = `e2e-new-${Date.now()}@example.com`;
    const csv = [
      "email,project_id,role,action",
      `${freshEmail},${state.projectId},member,add`,
    ].join("\n");

    const p = path.join(os.tmpdir(), `e2e-dryrun-valid-${Date.now()}.csv`);
    fs.writeFileSync(p, csv, "utf8");
    await page.setInputFiles('input[type="file"]', p);
    fs.unlinkSync(p);

    await page.getByRole("button", { name: /preview changes/i }).click();

    await expect(
      page.getByText(/all operations validated successfully/i)
    ).toBeVisible({ timeout: 30_000 });

    // "Apply Roles" is ENABLED
    await expect(page.getByRole("button", { name: /apply roles/i })).toBeEnabled();
  });
});

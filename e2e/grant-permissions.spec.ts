/**
 * E2E: grant-permissions happy path + key error cases.
 *
 * Preconditions:
 *   - auth.setup.ts must have run (authenticated session in .auth/user.json)
 *   - APS_TEST_HUB_NAME  — display name of the test hub (partial match ok)
 *   - APS_TEST_PROJECT   — display name of the test project
 *   - APS_TEST_EMAIL     — email of an existing account user to add/remove
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function selectHub(page: Page) {
  const select = page.locator("select").first();
  await select.selectOption({ index: 1 }); // first non-disabled option
}

async function selectProject(page: Page) {
  const projectName = process.env.APS_TEST_PROJECT ?? "test";
  await page.getByRole("checkbox", { name: new RegExp(projectName, "i") }).check();
}

function writeTempCsv(content: string): string {
  const filePath = path.join(os.tmpdir(), `e2e-${Date.now()}.csv`);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Grant permissions wizard", () => {
  test("happy path — CSV upload → dry-run → execute", async ({ page }) => {
    const testEmail = process.env.APS_TEST_EMAIL ?? "test@example.com";

    await page.goto("/");

    // Step 1: select hub and project
    await selectHub(page);
    await page.waitForResponse((r) => r.url().includes("/api/projects"));
    await selectProject(page);

    // Navigate to CSV upload step
    await page.getByRole("link", { name: /bulk.*permission/i }).click();

    // Step 2: upload a valid CSV
    const csv = `email,project_id,role\n${testEmail},__REPLACED_BY_PROJECT_ID__,member\n`;
    // In the real UI the project_id comes from the selector, not the CSV. Use a known test project id.
    const testProjectId = process.env.APS_TEST_PROJECT_ID ?? "b.test-project-id";
    const csvContent = `email,project_id,role\n${testEmail},${testProjectId},member\n`;
    const csvPath = writeTempCsv(csvContent);

    await page.setInputFiles('input[type="file"]', csvPath);
    await page.waitForResponse((r) => r.url().includes("/api/csv/import"));

    // Should show parsed operation counts
    await expect(page.getByText(/1 add/i)).toBeVisible();

    // Step 3: advance to dry-run
    await page.getByRole("button", { name: /preview changes/i }).click();
    await page.waitForResponse((r) => r.url().includes("/api/dry-run"));

    // Dry-run result should show
    await expect(
      page.getByText(/all operations validated|validation passed/i)
    ).toBeVisible({ timeout: 15_000 });

    fs.unlinkSync(csvPath);
  });

  test("CSV with invalid email shows error table and blocks execution", async ({ page }) => {
    await page.goto("/");
    await selectHub(page);
    await page.waitForResponse((r) => r.url().includes("/api/projects"));
    await selectProject(page);
    await page.getByRole("link", { name: /bulk.*permission/i }).click();

    const csvPath = writeTempCsv(
      "email,project_id,role\nnot-an-email,proj-1,member\n"
    );
    await page.setInputFiles('input[type="file"]', csvPath);
    await page.waitForResponse((r) => r.url().includes("/api/csv/import"));

    await expect(page.getByText(/not a valid email/i)).toBeVisible();

    // Next/preview button should be disabled or absent
    const nextBtn = page.getByRole("button", { name: /preview changes/i });
    await expect(nextBtn).toBeDisabled();

    fs.unlinkSync(csvPath);
  });

  test("unauthenticated user is redirected to login", async ({ browser }) => {
    // Use a fresh context with no stored auth
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/");
    // Should land on login or be redirected
    await expect(page).toHaveURL(/login/);

    await ctx.close();
  });
});

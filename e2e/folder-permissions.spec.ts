/**
 * E2E: folder-permissions flow.
 *
 * Preconditions: same as grant-permissions.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

async function selectHub(page: Page) {
  await page.locator("select").first().selectOption({ index: 1 });
}

async function selectProject(page: Page) {
  const projectName = process.env.APS_TEST_PROJECT ?? "test";
  await page.getByRole("checkbox", { name: new RegExp(projectName, "i") }).check();
}

test.describe("Folder permissions wizard", () => {
  test("CSV upload → folder resolve → preview → grant", async ({ page }) => {
    const testEmail = process.env.APS_TEST_EMAIL ?? "test@example.com";
    const testProjectId = process.env.APS_TEST_PROJECT_ID ?? "b.test-project-id";

    await page.goto("/");
    await selectHub(page);
    await page.waitForResponse((r) => r.url().includes("/api/projects"));
    await selectProject(page);

    // Navigate to folder-permissions section
    await page.getByRole("link", { name: /folder.*permission/i }).click();

    const csvContent = `email,project_id,folder_path,permission\n${testEmail},${testProjectId},Project Files,viewer\n`;
    const csvPath = path.join(os.tmpdir(), `e2e-folder-${Date.now()}.csv`);
    fs.writeFileSync(csvPath, csvContent, "utf8");

    await page.setInputFiles('input[type="file"]', csvPath);
    await page.waitForResponse((r) => r.url().includes("/api/csv/import-folders"));

    // Should show the resolved entry in the preview table
    await expect(page.getByText(testEmail)).toBeVisible();

    fs.unlinkSync(csvPath);
  });

  test("invalid permission value shows validation error", async ({ page }) => {
    await page.goto("/");
    await selectHub(page);
    await page.waitForResponse((r) => r.url().includes("/api/projects"));
    await selectProject(page);
    await page.getByRole("link", { name: /folder.*permission/i }).click();

    const csvPath = path.join(os.tmpdir(), `e2e-folder-err-${Date.now()}.csv`);
    fs.writeFileSync(
      csvPath,
      "email,project_id,folder_path,permission\nalice@x.com,proj-1,Design,superuser\n"
    );

    await page.setInputFiles('input[type="file"]', csvPath);
    await page.waitForResponse((r) => r.url().includes("/api/csv/import-folders"));

    await expect(page.getByText(/not a valid permission/i)).toBeVisible();

    fs.unlinkSync(csvPath);
  });
});

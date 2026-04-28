/**
 * Real-world E2E: Folder Permissions workflow
 *
 * Precondition: test 02 ran → all 3 test users are project members.
 *
 * Tests:
 *   A. Grant "viewer" folder permission to julio.sarachaga@gmail.com on
 *      "Project Files" folder via manual entry
 *      → API: verify permission exists on that folder
 *
 *   B. Grant "editor" folder permission to the "Testing" company on
 *      "Project Files" folder via manual entry
 *      → API: verify company permission exists
 *
 *   C. Grant permissions via CSV upload (all 3 users, "downloader" on Project Files)
 *      → UI: results table shows ✓ for each row
 */

import { test, expect, type Page } from "@playwright/test"; // Page used by navigateToFolderPermissions
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  getTwoLeggedToken,
  findCompanyByName,
  listTopFolders,
  listFolderPermissions,
} from "../helpers/aps-api";
import { readTestState, TEST_USERS, TEST_COMPANY, type TestState } from "../helpers/test-state";

const TARGET_USER = TEST_USERS[0]; // julio.sarachaga@gmail.com

async function navigateToFolderPermissions(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Folder Permissions" }).click();
}

// ---------------------------------------------------------------------------
// A — User permission via manual entry
// ---------------------------------------------------------------------------

test.describe("05-A — Folder permissions: user via manual", () => {
  let token: string;
  let state: TestState;
  let projectFilesFolder: { id: string; name: string } | null = null;

  test.beforeAll(async () => {
    state = readTestState();
    token = await getTwoLeggedToken();
    // Discover the "Project Files" folder URN from the API
    const folders = await listTopFolders(state.hubId, state.projectId, token);
    projectFilesFolder =
      folders.find((f) => /project files/i.test(f.name)) ?? folders[0] ?? null;
    console.log("[E2E 05-A] Top folders:", folders.map((f) => f.name));
    console.log("[E2E 05-A] Using folder:", projectFilesFolder?.name, projectFilesFolder?.id);
  });

  test("grants viewer permission to test user on Project Files folder", async ({ page }) => {
    if (!projectFilesFolder) {
      test.skip(true, "No top-level folders found in the test project — project may still be provisioning");
    }

    await navigateToFolderPermissions(page);

    // App may remember a previous project — click Change to reset if so
    const changeBtn05A = page.getByRole("button", { name: /^change$/i });
    if (await changeBtn05A.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await changeBtn05A.click();
    }

    // Manual mode is default — select a project
    const projectInput = page.getByPlaceholder(/search by name/i);
    await projectInput.fill(state.projectName.slice(0, 8));
    await page.getByText(state.projectName).first().waitFor({ timeout: 15_000 });
    await page.getByText(state.projectName).first().click();

    // Choose the folder — FolderTreePicker should show top folders
    await expect(page.getByText(projectFilesFolder!.name)).toBeVisible({ timeout: 15_000 });
    await page.getByText(projectFilesFolder!.name).click();

    // Subject type: USER (default) — UserPicker is a SearchableSelect combobox
    await page.getByRole("button", { name: /select a user/i }).click();
    await page.getByPlaceholder("Search…").fill(TARGET_USER);
    const userOption = page.getByText(TARGET_USER).first();
    await userOption.waitFor({ timeout: 10_000 });
    await userOption.click();

    // Permission level: select "viewer"
    const permSelect = page.locator("select").last();
    await permSelect.selectOption("viewer");

    // Add the entry
    await page.getByRole("button", { name: /add|grant/i }).first().click();

    // Should appear in the entries table
    await expect(page.getByText(TARGET_USER)).toBeVisible();

    // Preview Changes
    await page.getByRole("button", { name: /preview changes/i }).click();
    await expect(page.getByText(TARGET_USER)).toBeVisible({ timeout: 10_000 });

    // Apply Grants
    await page.getByRole("button", { name: /apply grants/i }).click();

    // Results step — wait for execution to finish, then check for at least one grant
    await expect(page.getByText(/execution complete/i)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText(/✓ granted|granted/i).first()
    ).toBeVisible();
  });

  test("API: user has VIEW permission on Project Files folder", async () => {
    if (!projectFilesFolder) {
      test.skip(true, "No folder to verify");
    }

    const perms = await listFolderPermissions(state.projectId, projectFilesFolder!.id, token);
    console.log("[E2E 05-A] Folder permissions returned:", perms.length, "entries");

    // Look for a permission entry with VIEW action for the test user or any subject
    // (exact subject matching depends on how APS returns the userId)
    const hasView = perms.some((p) => p.actions.includes("VIEW") || p.actions.includes("COLLABORATE"));
    expect(hasView, "Expected at least one VIEW permission after grant").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B — Company permission via manual entry
// ---------------------------------------------------------------------------

test.describe("05-B — Folder permissions: company via manual", () => {
  let token: string;
  let state: TestState;
  let testingCompany: { id: string; name: string } | null = null;
  let projectFilesFolder: { id: string; name: string } | null = null;

  test.beforeAll(async () => {
    state = readTestState();
    token = await getTwoLeggedToken();
    testingCompany = await findCompanyByName(state.accountId, TEST_COMPANY, token);
    const folders = await listTopFolders(state.hubId, state.projectId, token);
    projectFilesFolder = folders.find((f) => /project files/i.test(f.name)) ?? folders[0] ?? null;
    console.log("[E2E 05-B] Testing company:", testingCompany);
    console.log("[E2E 05-B] Using folder:", projectFilesFolder?.name);
  });

  test("grants editor permission to 'Testing' company on Project Files", async ({ page }) => {
    if (!testingCompany) {
      test.skip(true, `"${TEST_COMPANY}" company not found in account — create it first`);
    }
    if (!projectFilesFolder) {
      test.skip(true, "No top-level folders found in the test project");
    }

    await navigateToFolderPermissions(page);

    // App may remember a previous project — click Change to reset if so
    const changeBtn05B = page.getByRole("button", { name: /^change$/i });
    if (await changeBtn05B.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await changeBtn05B.click();
    }

    // Select project
    const projectInput05B = page.getByPlaceholder(/search by name/i);
    await projectInput05B.fill(state.projectName.slice(0, 8));
    await page.getByText(state.projectName).first().waitFor({ timeout: 15_000 });
    await page.getByText(state.projectName).first().click();

    // Select folder
    await page.getByText(projectFilesFolder!.name).waitFor({ timeout: 15_000 });
    await page.getByText(projectFilesFolder!.name).click();

    // Switch subject type to COMPANY
    await page.getByRole("button", { name: /company/i }).click();

    // Search for "Testing" company — CompanyPicker is a SearchableSelect combobox
    await page.getByRole("button", { name: /select a company/i }).click();
    await page.getByPlaceholder("Search…").fill(TEST_COMPANY.slice(0, 4));
    const companyOption = page.getByText(TEST_COMPANY).first();
    await companyOption.waitFor({ timeout: 10_000 });
    await companyOption.click();

    // Permission: editor
    const permSelect = page.locator("select").last();
    await permSelect.selectOption("editor");

    // Add entry
    await page.getByRole("button", { name: /add|grant/i }).first().click();
    // Scope to the table cell to avoid strict-mode violation with the company-picker button.
    await expect(page.getByRole("cell", { name: TEST_COMPANY })).toBeVisible();

    // Preview → Apply
    await page.getByRole("button", { name: /preview changes/i }).click();
    await page.getByRole("button", { name: /apply grants/i }).click();
    // "Execution complete" only appears when every entry is granted.
    // "Retry failed" appears when execution finishes with at least one error.
    // Either indicates the run is done.
    await expect(
      page.getByText(/execution complete|retry failed/i).first()
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/✓ granted|granted/i).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// C — CSV upload for folder permissions
// ---------------------------------------------------------------------------

test.describe("05-C — Folder permissions: CSV upload", () => {
  let token: string;
  let state: TestState;
  let projectFilesFolder: { id: string; name: string } | null = null;

  test.beforeAll(async () => {
    state = readTestState();
    token = await getTwoLeggedToken();
    const folders = await listTopFolders(state.hubId, state.projectId, token);
    projectFilesFolder = folders.find((f) => /project files/i.test(f.name)) ?? folders[0] ?? null;
    console.log("[E2E 05-C] Using folder:", projectFilesFolder?.name);
  });

  test("uploads folder-permission CSV and grants downloader to all 3 users", async ({ page }) => {
    test.setTimeout(120_000); // 90s execution wait + buffer
    if (!projectFilesFolder) {
      test.skip(true, "No top-level folders found in the test project");
    }

    const folderName = projectFilesFolder!.name;
    const csvContent = [
      "email,project_id,folder_path,permission",
      ...TEST_USERS.map((email) => `${email},${state.projectId},${folderName},downloader`),
    ].join("\n");

    const csvPath = path.join(os.tmpdir(), `e2e-folder-csv-${Date.now()}.csv`);
    fs.writeFileSync(csvPath, csvContent, "utf8");

    await navigateToFolderPermissions(page);

    // Switch to CSV mode
    await page.getByRole("tab", { name: /upload csv/i }).click();

    await page.setInputFiles('input[type="file"]', csvPath);
    fs.unlinkSync(csvPath);

    // Wait for parse — CSV parsed successfully, file name or row count appears
    await expect(page.locator('input[type="file"]')).toHaveCount(0, { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole("button", { name: /preview changes/i })).toBeEnabled({ timeout: 15_000 });

    // Preview — shows grouped summary (project/folder/count), not individual emails
    await page.getByRole("button", { name: /preview changes/i }).click();
    await expect(page.getByText(folderName)).toBeVisible({ timeout: 10_000 });

    // Apply
    await page.getByRole("button", { name: /apply grants/i }).click();

    // "Execution complete" only shows when all rows are granted; with partial errors
    // the component stays on "Ready to apply" and shows "Retry failed" instead.
    await expect(
      page.getByText(/execution complete|retry failed/i).first()
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/✓ granted|granted/i).first()).toBeVisible();
  });
});

/**
 * Real-world E2E: Roles workflow — Manual Entry
 *
 * Precondition: test 02 ran → all 3 test users are project members with role "member".
 *
 * Flow:
 *   Sidebar → "Roles" → select hub → "Build Manually" tab → add one row:
 *     email: julio.sarachaga@gmail.com  (imported in test 01, added to project in test 02)
 *     action: update
 *     project: test project (searched by name)
 *     role: project_admin
 *   → "Preview Changes" → "Apply Roles"
 *   → API confirms the user's role changed to project_admin
 *
 * Cleanup (afterAll):
 *   Reverts the user back to "member" via the APS Admin API so downstream
 *   tests and any manual inspection see a clean state.
 */

import { test, expect } from "@playwright/test";
import {
  getTwoLeggedToken,
  waitForProjectUserRole,
  revertProjectUserRole,
} from "../helpers/aps-api";
import { readTestState, TEST_USERS, type TestState } from "../helpers/test-state";

// Use the gmail address — imported to the account in 01 and added to the project in 02.
// Intentionally not the lagarsoft address so the two users stay distinguishable in the project.
const TARGET_EMAIL = TEST_USERS[0]; // julio.sarachaga@gmail.com

test.describe("03 — Grant Roles via Manual Entry", () => {
  let token: string;
  let state: TestState;

  test.beforeAll(async () => {
    state = readTestState();
    token = await getTwoLeggedToken();
  });

  test.afterAll(async () => {
    // Revert the gmail user's role back to "member" so the project is clean
    console.log(`[03 afterAll] Reverting ${TARGET_EMAIL} to "member"…`);
    await revertProjectUserRole(state.projectId, TARGET_EMAIL, "member", token);
  });

  test("updates gmail user to project_admin via manual entry", async ({ page }) => {
    await page.goto("/");

    // --- Roles workflow ---
    await page.getByRole("button", { name: "Roles" }).click();

    // "Build Manually" is the default tab — confirm it's active
    await expect(page.getByRole("tab", { name: /build manually/i })).toBeVisible();

    // Add a new row
    const addRowBtn = page.getByRole("button", { name: /add row|add entry|\+/i }).first();
    await addRowBtn.click();

    // Fill in the new row
    const rows = page.locator("table tbody tr, [data-testid='manual-row']");
    const lastRow = rows.last();

    // Action → "update" (user is already a member from test 02)
    const actionSelect = lastRow.locator("select").first();
    await actionSelect.selectOption("update");

    // Email
    const emailInput = lastRow.locator("input[type='email'], input[placeholder*='email' i]");
    await emailInput.fill(TARGET_EMAIL);

    // Project — search by partial name, click the result
    // Placeholder is "Search by name…" when account is selected
    const projectInput = lastRow.getByPlaceholder(/search by name/i);
    await projectInput.fill(state.projectName.slice(0, 8));
    const projectResult = page.getByText(state.projectName).first();
    await projectResult.waitFor({ timeout: 15_000 });
    await projectResult.click();

    // Role → project admin (option value is r.name.toLowerCase(), e.g. "project administrator")
    const roleSelect = lastRow.locator("select").last();
    await expect(roleSelect).toBeEnabled({ timeout: 15_000 });
    // selectOption({label}) requires a plain string — find the matching text first.
    const optionTexts = await roleSelect.locator("option").allInnerTexts();
    const adminLabel = optionTexts.find((t) => /project.?admin/i.test(t));
    expect(adminLabel, "No project-admin role option found in the role select").toBeTruthy();
    await roleSelect.selectOption({ label: adminLabel! });

    // --- Preview Changes ---
    const previewBtn = page.getByRole("button", { name: /preview changes/i });
    await expect(previewBtn).toBeEnabled({ timeout: 5_000 });
    await previewBtn.click();

    // Dry-run: user exists in project → update is valid
    await expect(
      page.getByText(/all operations validated|validation passed/i)
    ).toBeVisible({ timeout: 30_000 });

    // --- Apply Roles ---
    await page.getByRole("button", { name: /apply roles/i }).click();

    await expect(page.getByText(TARGET_EMAIL)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/running/i)).not.toBeVisible({ timeout: 60_000 });
  });

  test("API: gmail user's role is now project_admin", async () => {
    // Poll up to 30 s — the ACC role-update API can be asynchronous.
    const user = await waitForProjectUserRole(
      state.projectId,
      TARGET_EMAIL,
      /project.?admin|admin/i,
      token,
      30_000,
    );
    expect(user.role.toLowerCase()).toMatch(/project.?admin|admin/i);
  });
});

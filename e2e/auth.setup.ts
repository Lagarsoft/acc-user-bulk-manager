/**
 * Authentication setup for Playwright E2E tests.
 *
 * Runs once before the test suite and saves the browser session (cookies +
 * localStorage) to e2e/.auth/user.json so authenticated tests can reuse it
 * without going through the OAuth flow each time.
 *
 * In CI, set:
 *   APS_TEST_USER    — Autodesk account email for the test user
 *   APS_TEST_PASSWORD — Autodesk account password for the test user
 *
 * The test user must be an Account Admin on the hub configured in .env.local.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";

const AUTH_FILE = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const user = process.env.APS_TEST_USER;
  const password = process.env.APS_TEST_PASSWORD;
  if (!user || !password) {
    throw new Error(
      "APS_TEST_USER and APS_TEST_PASSWORD must be set in .env.local to run the auth setup"
    );
  }

  await page.goto("/login");

  // Click the APS OAuth sign-in link
  await page.getByRole("link", { name: /sign in/i }).click();

  // Autodesk login — now on signin.autodesk.com with a two-step flow
  await page.waitForURL(/autodesk\.com/, { timeout: 15_000 });

  // Step 1: email → Next
  const emailBox = page.getByRole("textbox", { name: /email/i });
  await emailBox.waitFor();
  await emailBox.fill(user);
  await page.getByRole("button", { name: /next/i }).click();

  // Step 2: password → Sign in
  const passwordBox = page.locator('input[type="password"]');
  await passwordBox.waitFor({ timeout: 15_000 });
  await passwordBox.fill(password);
  await page.getByRole("button", { name: /sign in|next|submit/i }).click();

  // Wait for OAuth callback to redirect back to the app
  await page.waitForURL("/", { timeout: 60_000 });
  await expect(page).toHaveURL("/");

  // Persist session for reuse
  await page.context().storageState({ path: AUTH_FILE });
});

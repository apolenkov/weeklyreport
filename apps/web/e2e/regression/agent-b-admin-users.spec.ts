import { expect, test } from "@playwright/test";

import { loginByCookie, wipeAndReseed } from "./helpers/dev-auth";

const ADMIN_URL = "http://localhost:3000/admin?tab=users";
const SCREENSHOT_DIR = ".planning/regression/screenshots/agent-b-admin-users";

test.describe("ADM-010..020: Admin Panel - Users Tab", () => {
  let seeded = false;

  test.beforeEach(async ({ page }) => {
    await loginByCookie(page, { role: "head", redirect: "/admin?tab=users" });
    if (!seeded) {
      await wipeAndReseed(page, "advanced");
      seeded = true;
    }
    await loginByCookie(page, { role: "head", redirect: "/admin?tab=users" });
    await page.goto(ADMIN_URL);
    await page.waitForSelector('[data-testid="admin-panel"]', {
      timeout: 10_000,
    });
    await page.locator('[data-testid="users-table"]').waitFor({
      state: "visible",
      timeout: 10_000,
    });
  });

  test("ADM-010: Users table displays seeded users", async ({ page }) => {
    const userRows = page.locator('[data-testid="users-table"] tbody tr');
    expect(await userRows.count()).toBeGreaterThanOrEqual(8);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-010.png` });
  });

  test("ADM-011: Users table exposes current headers", async ({ page }) => {
    const table = page.locator('[data-testid="users-table"]');
    for (const header of ["Name", "Email", "Role", "Group", "Actions"]) {
      await expect(
        table.getByRole("columnheader", { name: header }),
      ).toBeVisible();
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-011.png` });
  });

  test("ADM-012: Email displayed", async ({ page }) => {
    await expect(page.getByText("head@customreport.local")).toBeVisible();
    await expect(page.getByText(/@customreport\.local/).first()).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-012.png` });
  });

  test("ADM-013: Role column displays role labels", async ({ page }) => {
    const roleTexts = await page
      .locator('[data-testid="users-table"] tbody tr td:nth-child(3)')
      .allTextContents();
    expect(roleTexts.join(" ")).toMatch(/head|lead|admin|viewer/i);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-013.png` });
  });

  test("ADM-014: Head/admin users still expose explicit actions", async ({
    page,
  }) => {
    const headRow = page.locator('[data-testid="users-table"] tbody tr', {
      hasText: "head@customreport.local",
    });
    await expect(headRow.getByRole("button", { name: /Edit / })).toBeVisible();
    await expect(
      headRow.getByRole("button", { name: /Delete / }),
    ).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-014.png` });
  });

  test("ADM-015: Lead/viewer users expose delete action", async ({ page }) => {
    const viewerRow = page.locator('[data-testid="users-table"] tbody tr', {
      hasText: "viewer@customreport.local",
    });
    await expect(
      viewerRow.getByRole("button", { name: /Delete / }),
    ).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-015.png` });
  });

  test('ADM-016: Click "Add User" opens dialog', async ({ page }) => {
    await page.getByRole("button", { name: /Add (new )?User/i }).click();

    const dialog = page.getByRole("dialog", { name: "Add user" });
    await expect(dialog).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-016.png` });
  });

  test("ADM-017: Add User form: Name, Email, Role, Group fields", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Add (new )?User/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add user" });

    await expect(dialog.getByLabel("Name")).toBeVisible();
    await expect(dialog.getByLabel("Email")).toBeVisible();
    await expect(dialog.getByLabel("Role")).toBeVisible();
    await expect(dialog.getByLabel("Group")).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-017.png` });
  });

  test('ADM-018: Role select defaults to "lead"', async ({ page }) => {
    await page.getByRole("button", { name: /Add (new )?User/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add user" });

    await expect(dialog.getByLabel("Role")).toHaveValue("lead");

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-018.png` });
  });

  test("ADM-019: Submit Add User calls saveUser mutation", async ({ page }) => {
    await page.getByRole("button", { name: /Add (new )?User/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add user" });

    const stamp = Date.now();
    const savePromise = page.waitForResponse(
      (r) => r.url().includes("admin.saveUser") && r.status() === 200,
      { timeout: 10_000 },
    );
    await dialog.getByLabel("Name").fill(`Test User ${stamp}`);
    await dialog.getByLabel("Email").fill(`testuser${stamp}@test.local`);
    await dialog.getByRole("button", { name: "Add User" }).click();
    await savePromise;

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-019.png` });
  });

  test('ADM-020: Success toast says "User saved"', async ({ page }) => {
    await page.getByRole("button", { name: /Add (new )?User/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add user" });

    const stamp = Date.now();
    await dialog.getByLabel("Name").fill(`Toast Test ${stamp}`);
    await dialog.getByLabel("Email").fill(`toasttest${stamp}@test.local`);
    await dialog.getByRole("button", { name: "Add User" }).click();

    await expect(page.getByText("User saved")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-020.png` });
  });
});

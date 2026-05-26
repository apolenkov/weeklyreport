import { expect, test } from "@playwright/test";

import { loginByCookie, wipeAndReseed } from "./helpers/dev-auth";

const ADMIN_GROUPS_URL = "http://localhost:3000/admin?tab=groups";
const ADMIN_USERS_URL = "http://localhost:3000/admin?tab=users";
const ADMIN_ACTIONS_URL = "http://localhost:3000/admin?tab=actions";

test.describe("REG-ADM-GROUP-001: admin reporting groups", () => {
  test("creates a group, assigns a user to it, and records actions", async ({
    page,
  }) => {
    const stamp = Date.now();
    const groupName = "Regression Group " + stamp.toString();

    await loginByCookie(page, {
      role: "head",
      redirect: "/admin?tab=groups",
      maxRetries: 4,
    });
    await wipeAndReseed(page, "manual-uat");
    await loginByCookie(page, {
      role: "head",
      redirect: "/admin?tab=groups",
      maxRetries: 4,
    });

    await page.goto(ADMIN_GROUPS_URL);
    await page.waitForSelector('[data-testid="groups-tab"]', {
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Add group" }).click();
    const groupDialog = page.getByRole("dialog", { name: "Add group" });
    await expect(groupDialog).toBeVisible();

    const saveGroup = page.waitForResponse(
      (response) =>
        response.url().includes("admin.saveReportingGroup") &&
        response.status() === 200,
      { timeout: 15_000 },
    );
    await groupDialog.getByLabel("Name").fill(groupName);
    await groupDialog
      .getByLabel("Description")
      .fill("Created by regression coverage.");
    await groupDialog.getByRole("button", { name: "Add Group" }).click();
    await saveGroup;

    await page.getByLabel("Search groups").fill(groupName);
    await expect(page.locator('[data-testid="groups-table"]')).toContainText(
      groupName,
    );

    await page.goto(ADMIN_USERS_URL);
    await page.locator('[data-testid="users-table"]').waitFor({
      state: "visible",
      timeout: 15_000,
    });
    await page.getByLabel("Search users").fill("Мария");

    const mariaRow = page.locator('[data-testid="users-table"] tbody tr', {
      hasText: "Мария К.",
    });
    await expect(mariaRow).toBeVisible();
    await mariaRow.getByRole("button", { name: /Edit / }).click();

    const userDialog = page.getByRole("dialog", { name: "Edit user" });
    await expect(userDialog).toBeVisible();
    await userDialog.getByLabel("Group").selectOption({ label: groupName });

    const saveUser = page.waitForResponse(
      (response) =>
        response.url().includes("admin.saveUser") && response.status() === 200,
      { timeout: 15_000 },
    );
    await userDialog.getByRole("button", { name: "Save Changes" }).click();
    await saveUser;

    await page.getByLabel("Search users").fill("Мария");
    await expect(mariaRow).toContainText(groupName);

    await page.goto(ADMIN_ACTIONS_URL);
    await page.waitForSelector('[data-testid="action-log-tab"]', {
      timeout: 15_000,
    });
    await page.getByLabel("Search actions").fill("admin.saveReportingGroup");
    await expect(
      page
        .locator('[data-testid="action-log-tab"] tbody tr')
        .filter({ hasText: "admin.saveReportingGroup" })
        .first(),
    ).toContainText("success");

    await page.getByLabel("Search actions").fill("admin.saveUser");
    await expect(
      page
        .locator('[data-testid="action-log-tab"] tbody tr')
        .filter({ hasText: "admin.saveUser" })
        .first(),
    ).toContainText("success");
  });
});

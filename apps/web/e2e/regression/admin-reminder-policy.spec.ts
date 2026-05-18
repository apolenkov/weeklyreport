/**
 * TD-04 / Phase 44 — ReminderPolicy editor regression suite.
 *
 * Tests the /admin?tab=reminders CRUD flow with a live dev stack.
 * Covers: policy list, new policy form, edit pre-fill, delete dialog.
 */

import { expect, test } from "@playwright/test";

import { loginByCookie } from "./helpers/dev-auth";

const REMINDERS_URL = "http://localhost:3000/admin?tab=reminders";

test.describe("REG-TD04: Admin ReminderPolicy editor", () => {
  test.beforeEach(async ({ page }) => {
    await loginByCookie(page, {
      role: "admin",
      redirect: "/admin?tab=reminders",
      maxRetries: 3,
    });
    await page.goto(REMINDERS_URL);
    await page.waitForSelector("[data-testid^='policy-row-']", {
      timeout: 15_000,
    });
  });

  test("SC-P44-01: seeded policies are visible in the list", async ({
    page,
  }) => {
    const rows = page.locator("[data-testid^='policy-row-']");
    await expect(rows.first()).toBeVisible();
    // 2 seeded policies (deadline + escalation)
    await expect(rows).toHaveCount(2);
  });

  test("SC-P44-02: New Policy button shows the form", async ({ page }) => {
    await expect(
      page.locator("[data-testid='policy-form']"),
    ).not.toBeVisible();
    await page.locator("[data-testid='new-policy-button']").click();
    await expect(page.locator("[data-testid='policy-form']")).toBeVisible();
  });

  test("SC-P44-03: form has offset, unit, and direction controls", async ({
    page,
  }) => {
    await page.locator("[data-testid='new-policy-button']").click();
    await expect(
      page.getByRole("spinbutton", { name: /reminder offset amount/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: /reminder offset unit/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: /before or after deadline/i }),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='policy-save-button']"),
    ).toBeVisible();
  });

  test("SC-P44-05: edit button pre-fills the offset field", async ({
    page,
  }) => {
    const editBtn = page.locator("[data-testid^='edit-']").first();
    await editBtn.click();
    const form = page.locator("[data-testid='policy-form']");
    await expect(form).toBeVisible();
    const value = await page
      .getByRole("spinbutton", { name: /reminder offset amount/i })
      .inputValue();
    // Seeded deadline policy has offsetMinutes=-1440 → displayed as 1440
    expect(Number(value)).toBeGreaterThan(0);
  });

  test("SC-P44-06: expand shows policy details panel", async ({ page }) => {
    await page.locator("[data-testid^='expand-']").first().click();
    await expect(
      page.locator("[data-testid^='policy-details-']").first(),
    ).toBeVisible();
  });

  test("SC-P44-07: delete button opens confirmation dialog", async ({
    page,
  }) => {
    await page.locator("[data-testid^='remove-']").first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    // Cancel without deleting
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });
});

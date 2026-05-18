/**
 * TD-04 / Phase 44 — ReminderPolicy editor E2E tests.
 *
 * Covers the admin reminders tab CRUD UI:
 *   SC-P44-01  Policy list renders seeded policies
 *   SC-P44-02  "New Policy" button shows the policy form
 *   SC-P44-03  Policy form fields are present and interactive
 *   SC-P44-04  Saving a new policy adds it to the list
 *   SC-P44-05  Edit button pre-fills the form with existing policy data
 *   SC-P44-06  Expand/collapse shows and hides policy details
 *   SC-P44-07  Delete button shows confirmation dialog
 *
 * Uses the `adminPage` fixture (admin role required for /admin routes).
 */

import { test, expect } from "./fixtures";

const REMINDERS_URL = "/admin?tab=reminders";

test.describe("Admin — ReminderPolicy editor (TD-04)", () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(REMINDERS_URL);
    await adminPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await adminPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("SC-P44-01: policy list renders at least one seeded policy row", async ({
    adminPage,
  }) => {
    // There are 2 seeded policies (deadline + escalation).
    // We assert ≥1 to stay resilient to seed changes.
    const rows = adminPage.locator("[data-testid^='policy-row-']");
    await expect(rows.first()).toBeVisible();
    await expect(rows).toHaveCount(2);
  });

  test("SC-P44-02: New Policy button reveals the policy form", async ({
    adminPage,
  }) => {
    // Form should not exist before clicking
    await expect(
      adminPage.locator("[data-testid='policy-form']"),
    ).not.toBeVisible();

    await adminPage.locator("[data-testid='new-policy-button']").click();

    await expect(
      adminPage.locator("[data-testid='policy-form']"),
    ).toBeVisible();
  });

  test("SC-P44-03: policy form shows all required fields", async ({
    adminPage,
  }) => {
    await adminPage.locator("[data-testid='new-policy-button']").click();

    // Offset amount and unit
    await expect(
      adminPage.getByRole("spinbutton", { name: /reminder offset amount/i }),
    ).toBeVisible();
    await expect(
      adminPage.getByRole("combobox", { name: /reminder offset unit/i }),
    ).toBeVisible();

    // Before / after deadline direction
    await expect(
      adminPage.getByRole("combobox", { name: /before or after deadline/i }),
    ).toBeVisible();

    // Save button
    await expect(
      adminPage.locator("[data-testid='policy-save-button']"),
    ).toBeVisible();
  });

  test("SC-P44-04: saving a new policy adds it to the list", async ({
    adminPage,
  }) => {
    const initialCount = await adminPage
      .locator("[data-testid^='policy-row-']")
      .count();

    await adminPage.locator("[data-testid='new-policy-button']").click();

    // Fill the offset amount
    const offsetInput = adminPage.getByRole("spinbutton", {
      name: /reminder offset amount/i,
    });
    await offsetInput.fill("48");

    // Save
    await adminPage.locator("[data-testid='policy-save-button']").click();
    await adminPage.waitForLoadState("networkidle", { timeout: 10_000 });

    // One more policy in the list
    const newCount = await adminPage
      .locator("[data-testid^='policy-row-']")
      .count();
    expect(newCount).toBe(initialCount + 1);
  });

  test("SC-P44-05: edit button opens form with pre-filled offset", async ({
    adminPage,
  }) => {
    // Click edit on first policy row
    const firstEditButton = adminPage
      .locator("[data-testid^='edit-']")
      .first();
    await firstEditButton.click();

    const form = adminPage.locator("[data-testid='policy-form']");
    await expect(form).toBeVisible();

    // Offset field must have a non-empty numeric value (seeded -1440 → 1440)
    const offsetInput = adminPage.getByRole("spinbutton", {
      name: /reminder offset amount/i,
    });
    const value = await offsetInput.inputValue();
    expect(Number(value)).toBeGreaterThan(0);
  });

  test("SC-P44-06: expand button shows policy details panel", async ({
    adminPage,
  }) => {
    // Details panel hidden initially
    const firstPolicyRow = adminPage
      .locator("[data-testid^='policy-row-']")
      .first();
    await expect(firstPolicyRow).toBeVisible();

    const expandBtn = adminPage.locator("[data-testid^='expand-']").first();
    await expandBtn.click();

    // Details panel becomes visible
    const detailsPanel = adminPage
      .locator("[data-testid^='policy-details-']")
      .first();
    await expect(detailsPanel).toBeVisible();
  });

  test("SC-P44-07: remove button shows confirmation dialog", async ({
    adminPage,
  }) => {
    const removeBtn = adminPage.locator("[data-testid^='remove-']").first();
    await removeBtn.click();

    // Expect a confirmation dialog / alert dialog
    const dialog = adminPage.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    // Dialog should have a confirm/delete action
    const confirmBtn = dialog.getByRole("button", {
      name: /delete|confirm|remove/i,
    });
    await expect(confirmBtn).toBeVisible();

    // Cancel without deleting
    const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });
});

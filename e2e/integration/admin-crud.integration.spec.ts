/**
 * Admin CRUD integration tests — verifies that admin UI mutations persist to
 * PostgreSQL via real tRPC procedures (no mocks).
 */

import { expect, test } from "./fixtures";
import { prisma } from "./helpers/db";
import {
  ACTIVE_REPORT_ID,
  LEAD_1_ID,
  LEAD_OLGA_ID,
  SEED_PRODUCTS,
} from "./helpers/seed-ids";
import { performAndWaitForTrpcMutation } from "./helpers/trpc-response";

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

test.describe("Admin CRUD (integration)", () => {
  test("admin can create a new product and it appears in DB", async ({
    adminPage,
  }) => {
    await adminPage.goto("/admin/products");

    const addBtn = adminPage.getByRole("button", { name: "Add new product" });
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    // Scope to the dialog: the products toolbar also has a "Filter products
    // by name" search box whose accessible name matches a loose /name/i
    // locator, so an unscoped getByLabel grabs the wrong field.
    const dialog = adminPage.getByRole("dialog", { name: /add product/i });
    await expect(dialog).toBeVisible();

    const nameField = dialog.getByLabel("Product Name");
    const uniqueName = `IntegrationTest Product ${Date.now()}`;
    await nameField.fill(uniqueName);
    await dialog.getByLabel("Lead Owner").selectOption(LEAD_1_ID);

    const saveBtn = dialog.getByRole("button", { name: "Add Product" });
    await expect(saveBtn).toBeEnabled();
    try {
      await performAndWaitForTrpcMutation(adminPage, () => saveBtn.click());

      const product = await prisma.project.findFirst({
        where: { name: uniqueName },
      });
      expect(product).not.toBeNull();
    } finally {
      // This row is outside the seed baseline; clean it even after an assertion
      // or navigation failure so later single-worker specs keep stable counts.
      await prisma.project.deleteMany({ where: { name: uniqueName } });
    }
  });

  test("admin Organization identity update persists across page reload", async ({
    adminPage,
  }) => {
    await adminPage.goto("/admin/settings");

    const shortNameField = adminPage.getByRole("textbox", {
      name: /^Short name$/i,
    });
    await expect(shortNameField).toBeVisible({ timeout: 15_000 });
    // Wait for the org query to seed the form: editing while it still loads
    // marks the form dirty, the late-arriving data is then ignored, and the
    // empty Full name keeps Save disabled forever.
    await expect(shortNameField).not.toHaveValue("", { timeout: 15_000 });

    // shortName is max 16 chars; keep the value short enough to fit.
    const newShortName = `Tst${Date.now() % 10_000}`;
    await shortNameField.fill(newShortName);

    const saveBtn = adminPage.getByRole("button", {
      name: /save organization identity/i,
    });
    await performAndWaitForTrpcMutation(adminPage, () =>
      saveBtn.last().click(),
    );

    try {
      const org = await prisma.organization.findUnique({
        where: { id: "singleton" },
      });
      expect(org?.shortName).toBe(newShortName);
      const shortNamePattern = new RegExp(escapeRegExp(newShortName));

      await adminPage.goto("/head/dashboard");
      await expect(adminPage.getByText(shortNamePattern).first()).toBeVisible();

      await adminPage.goto(
        `/lead/report/${ACTIVE_REPORT_ID}?authorId=${LEAD_OLGA_ID}`,
      );
      await expect(adminPage.getByText(shortNamePattern).first()).toBeVisible();
    } finally {
      // Restore seed value to avoid cross-test pollution.
      await prisma.organization.update({
        where: { id: "singleton" },
        data: { shortName: "PEO" },
      });
    }
  });

  test("admin product list reflects DB state for a known seed product", async ({
    adminPage,
  }) => {
    await adminPage.goto("/admin/products");

    const firstSeededProduct = SEED_PRODUCTS.find(
      (product) => product.leadId === LEAD_1_ID,
    );
    if (!firstSeededProduct) {
      throw new Error("No seed products found for LEAD_1_ID");
    }
    const persistedProduct = await prisma.project.findUnique({
      where: { id: firstSeededProduct.id },
    });
    expect(persistedProduct).toMatchObject({
      name: firstSeededProduct.name,
      leadId: LEAD_1_ID,
    });

    // Page should mention at least one seeded name. The
    // /admin/products route redirects to /admin?tab=products, which mounts
    // AdminPanel and fires the admin.snapshot tRPC query async. Wait for
    // the seeded product name to appear in the rendered DOM before
    // snapshotting HTML — Playwright will retry the locator until it
    // resolves or hits the default expect timeout.
    await expect(
      adminPage.getByText(firstSeededProduct.name).first(),
    ).toBeVisible();

    const html = await adminPage.content();
    expect(html).toContain(firstSeededProduct.name);
  });
});

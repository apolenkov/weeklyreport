/**
 * Admin CRUD integration tests — verifies that admin UI mutations persist to
 * PostgreSQL via real tRPC procedures (no mocks).
 */

import { test, expect } from './fixtures';
import { prisma } from './helpers/db';
import { LEAD_POLENKOV_ID } from './helpers/seed-ids';

test.describe('Admin CRUD (integration)', () => {
  test('admin can create a new product and it appears in DB', async ({
    headPage,
  }) => {
    await headPage.goto('/admin/products');

    const addBtn = headPage.getByRole('button', { name: /add|new|create/i });
    if (!(await addBtn.count())) {
      // eslint-disable-next-line playwright/no-skipped-test
      test.skip(
        true,
        'Add Product button not present on /admin/products — TODO(plan-26)',
      );
    }
    await addBtn.first().click();

    const nameField = headPage.getByLabel(/name/i).first();
    const uniqueName = `IntegrationTest Product ${Date.now()}`;
    await nameField.fill(uniqueName);

    const saveBtn = headPage.getByRole('button', {
      name: /^(save|create|add)/i,
    });
    await saveBtn.last().click();

    await headPage.waitForResponse(
      (r) =>
        r.url().includes('/trpc/') &&
        r.request().method() === 'POST',
      { timeout: 15_000 },
    );

    const product = await prisma.project.findFirst({
      where: { name: uniqueName },
    });
    expect(product).not.toBeNull();

    // Cleanup — this row is outside the seed baseline, so resetMutations()
    // (which only re-upserts seeded rows) won't remove it.
    if (product) {
      await prisma.project.delete({ where: { id: product.id } });
    }
  });

  test('admin AppSettings update persists across page reload', async ({
    headPage,
  }) => {
    await headPage.goto('/admin/settings');

    const deptField = headPage.getByLabel(/department/i).first();
    if (!(await deptField.count())) {
      // eslint-disable-next-line playwright/no-skipped-test
      test.skip(
        true,
        '/admin/settings department field not present — TODO(plan-26)',
      );
    }

    const newName = `Core Development ${Date.now()}`;
    await deptField.fill(newName);

    const saveBtn = headPage.getByRole('button', { name: /save/i });
    await saveBtn.last().click();

    await headPage.waitForResponse(
      (r) =>
        r.url().includes('/trpc/') &&
        r.request().method() === 'POST',
      { timeout: 15_000 },
    );

    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' },
    });
    expect(settings?.departmentName).toBe(newName);

    // Restore seed value to avoid cross-test pollution; resetMutations would
    // also restore but is heavier than a single update.
    await prisma.appSettings.update({
      where: { id: 'singleton' },
      data: { departmentName: 'Core Development' },
    });
  });

  test('admin product list reflects DB state for a known seed product', async ({
    headPage,
  }) => {
    await headPage.goto('/admin/products');

    const polenkovProductCount = await prisma.project.count({
      where: { leadId: LEAD_POLENKOV_ID },
    });
    expect(polenkovProductCount).toBe(2); // CRM Platform, Data Analytics Suite

    // Page should mention at least one of the seeded names. The
    // /admin/products route redirects to /admin?tab=products, which mounts
    // AdminPanel and fires the admin.snapshot tRPC query async. Wait for
    // the seeded product name to appear in the rendered DOM before
    // snapshotting HTML — Playwright will retry the locator until it
    // resolves or hits the default expect timeout.
    await expect(
      headPage.getByText(/CRM Platform|Data Analytics Suite/).first(),
    ).toBeVisible();

    const html = await headPage.content();
    expect(
      /CRM Platform|Data Analytics Suite/.test(html),
    ).toBe(true);
  });
});

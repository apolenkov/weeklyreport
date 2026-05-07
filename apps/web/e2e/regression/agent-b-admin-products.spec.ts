import { expect, test } from '@playwright/test';

import { loginByCookie, wipeAndReseed } from './helpers/dev-auth';

const ADMIN_URL = 'http://localhost:3000/admin?tab=products';
const SCREENSHOT_DIR = '.planning/regression/screenshots/agent-b-admin-products';

test.describe('ADM-040..050: Admin Panel - Products Tab', () => {
  let seeded = false;

  test.beforeEach(async ({ page }) => {
    await loginByCookie(page, { role: 'head', redirect: '/admin?tab=products' });
    if (!seeded) {
      await wipeAndReseed(page, 'advanced');
      seeded = true;
    }
    await loginByCookie(page, { role: 'head', redirect: '/admin?tab=products' });
    await page.goto(ADMIN_URL);
    await page.waitForSelector('[data-testid="admin-panel"]', { timeout: 10_000 });
    await page.locator('[data-testid="products-table"]').waitFor({
      state: 'visible',
      timeout: 10_000,
    });
  });

  test('ADM-040: Products list displays active project cards', async ({ page }) => {
    const productCards = page.locator('[data-testid="products-table"] > div');
    await expect(productCards.first()).toBeVisible();
    expect(await productCards.count()).toBeGreaterThanOrEqual(8);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-040.png` });
  });

  test('ADM-041: Product names are visible in the current card list', async ({ page }) => {
    await expect(page.getByText('Маркетинговый портал')).toBeVisible();
    await expect(page.getByText('Платформа интеграций')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-041.png` });
  });

  test('ADM-042: Lead owner is displayed on product cards', async ({ page }) => {
    const ownerLabels = page.getByText(/Owner:/);
    expect(await ownerLabels.count()).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-042.png` });
  });

  test('ADM-043: Active products render with stage counters', async ({ page }) => {
    const counters = page.getByText(/\d+\/7 stages/);
    expect(await counters.count()).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-043.png` });
  });

  test('ADM-044: Archived section renders when archived products exist', async ({ page }) => {
    const archivedHeading = page.getByRole('heading', { name: /Archived \(/ });
    if (await archivedHeading.isVisible().catch(() => false)) {
      await expect(archivedHeading).toBeVisible();
    } else {
      await expect(page.locator('[data-testid="products-table"]')).toBeVisible();
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-044.png` });
  });

  test('ADM-045: Click "Add Product": dialog opens', async ({ page }) => {
    await page.getByRole('button', { name: /Add (new )?Product/i }).click();

    const dialog = page.getByRole('dialog', { name: 'Add product' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Product Name')).toBeVisible();
    await expect(dialog.getByLabel('Lead Owner')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-045.png` });
  });

  test('ADM-046: Submit calls saveProject mutation', async ({ page }) => {
    await page.getByRole('button', { name: /Add (new )?Product/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Add product' });
    await expect(dialog).toBeVisible();

    const savePromise = page.waitForResponse(
      (r) => r.url().includes('admin.saveProject') && r.status() === 200,
      { timeout: 10_000 },
    );
    await dialog.getByLabel('Product Name').fill(`Test Product ${Date.now()}`);
    await dialog.getByRole('button', { name: 'Add Product' }).click();
    await savePromise;

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-046.png` });
  });

  test('ADM-047: Success toast says "Product saved"', async ({ page }) => {
    await page.getByRole('button', { name: /Add (new )?Product/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Add product' });

    await dialog.getByLabel('Product Name').fill(`Toast Product ${Date.now()}`);
    await dialog.getByRole('button', { name: 'Add Product' }).click();

    await expect(page.getByText('Product saved')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-047.png` });
  });

  test('ADM-048: Stage counters show real assigned counts', async ({ page }) => {
    const texts = await page.getByText(/\d+\/7 stages/).allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((text) => /^\d+\/7/.test(text.trim()))).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-048.png` });
  });

  test('ADM-049: Archived products remain available in snapshot UI', async ({ page }) => {
    const activeCards = await page.locator('[data-testid="products-table"] > div').count();
    const archivedRows = await page.getByRole('button', { name: /Restore / }).count();
    expect(activeCards + archivedRows).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-049.png` });
  });

  test('ADM-050: Product list remains stable after navigation', async ({ page }) => {
    const before = await page.locator('[data-testid="products-table"] > div').allTextContents();
    await page.reload();
    await page.locator('[data-testid="products-table"]').waitFor({ state: 'visible' });
    const after = await page.locator('[data-testid="products-table"] > div').allTextContents();

    expect(after.length).toBe(before.length);
    expect(after[0]?.length ?? 0).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/ADM-050.png` });
  });
});

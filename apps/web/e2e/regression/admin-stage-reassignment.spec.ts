import { expect, test } from '@playwright/test';

import { loginByCookie, wipeAndReseed } from './helpers/dev-auth';

const ADMIN_PRODUCTS_URL = 'http://localhost:3000/admin?tab=products';
const ADMIN_ACTIONS_URL = 'http://localhost:3000/admin?tab=actions';
const PRODUCT_NAME = 'DevOps-инструменты';
const STAGE_NAME = 'Testing';

test.describe('REG-ADM-STAGE-001: admin product stage reassignment', () => {
  test('replaces one product/stage assignee and records the mutation', async ({
    page,
  }) => {
    await loginByCookie(page, {
      role: 'head',
      redirect: '/admin?tab=products',
      maxRetries: 4,
    });
    await wipeAndReseed(page, 'manual-uat');
    await loginByCookie(page, {
      role: 'head',
      redirect: '/admin?tab=products',
      maxRetries: 4,
    });

    await page.goto(ADMIN_PRODUCTS_URL);
    await page.waitForSelector('[data-testid="admin-panel"]', {
      timeout: 15_000,
    });
    await page.locator('[data-testid="products-table"]').waitFor({
      state: 'visible',
      timeout: 15_000,
    });

    await page
      .getByLabel(`Expand stage assignments for ${PRODUCT_NAME}`)
      .click();

    const testingSelect = page.getByLabel(
      `Assign ${STAGE_NAME} stage for ${PRODUCT_NAME}`,
    );
    await expect(testingSelect).toBeVisible();
    const igorValue = await testingSelect
      .locator('option', { hasText: /^Игорь$/ })
      .getAttribute('value');
    const mariaValue = await testingSelect
      .locator('option', { hasText: /^Мария$/ })
      .getAttribute('value');
    expect(igorValue).toBeTruthy();
    expect(mariaValue).toBeTruthy();

    const saveAsIgor = page.waitForResponse(
      (response) =>
        response.url().includes('admin.saveStageAssignment') &&
        response.status() === 200,
      { timeout: 15_000 },
    );
    await testingSelect.selectOption(igorValue!);
    await saveAsIgor;
    await expect(testingSelect).toHaveValue(igorValue!);

    const saveAsMaria = page.waitForResponse(
      (response) =>
        response.url().includes('admin.saveStageAssignment') &&
        response.status() === 200,
      { timeout: 15_000 },
    );
    await testingSelect.selectOption(mariaValue!);
    await saveAsMaria;
    await expect(testingSelect).toHaveValue(mariaValue!);

    await page.reload();
    await page.locator('[data-testid="products-table"]').waitFor({
      state: 'visible',
      timeout: 15_000,
    });
    await page
      .getByLabel(`Expand stage assignments for ${PRODUCT_NAME}`)
      .click();

    const reloadedTestingSelect = page.getByLabel(
      `Assign ${STAGE_NAME} stage for ${PRODUCT_NAME}`,
    );
    await expect(reloadedTestingSelect).toHaveValue(mariaValue!);

    await page.goto(ADMIN_ACTIONS_URL);
    await page.waitForSelector('[data-testid="action-log-tab"]', {
      timeout: 15_000,
    });
    await page.getByLabel('Search actions').fill('admin.saveStageAssignment');

    const actionLog = page.locator('[data-testid="action-log-tab"]');
    const mutationRows = actionLog
      .locator('tbody tr')
      .filter({ hasText: 'admin.saveStageAssignment' });
    await expect(mutationRows.first()).toBeVisible();
    await expect(mutationRows.first().getByText('success')).toBeVisible();
  });
});

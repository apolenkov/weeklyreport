import { expect, test } from '@playwright/test';

test('lead report page autosaves, confirms submit, and stays locked after reload', async ({ page }) => {
  await page.goto('/lead/report');

  await expect(page.getByRole('heading', { name: 'Мой отчёт' })).toBeVisible();

  await page.getByLabel('Project 1 traffic light').selectOption('green');
  await page.getByLabel('Current item 1').fill('Updated current week item');

  await expect(page.getByText('Сохранено')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Current item 1')).toHaveValue('Updated current week item');

  await page.getByRole('button', { name: 'Submit section' }).click();
  await expect(page.getByRole('dialog')).toContainText('Вы уверены?');
  await page.getByRole('button', { name: 'Confirm submit' }).click();

  await expect(page.getByText('Секция отправлена')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Project 1 traffic light')).toBeDisabled();
  await expect(page.getByLabel('Current item 1')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Submit section' })).toHaveCount(0);
});

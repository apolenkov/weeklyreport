/**
 * Product-ready progressive regression.
 *
 * This is the release gate for the core idea manifest:
 * independent lead capture -> head review -> published archive visibility ->
 * admin operations. It always starts from a clean dev fixture and saves
 * logs/screenshots as evidence for manual review.
 */

import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { loginByCookie, wipeAndReseed } from './helpers/dev-auth';

const WEB = 'http://localhost:3000';
const API = 'http://localhost:3002';
const ACTIVE_REPORT_ID = 'a0000000-0000-4000-8000-000000000001';
const EVIDENCE_DIR = path.resolve(
  __dirname,
  '../../../../.planning/regression/evidence/product-ready-progressive',
);

const USERS = {
  viewer: { role: 'viewer' as const, email: 'viewer@customreport.local' },
  lead: { role: 'lead' as const, email: 'lead1@customreport.local' },
  head: { role: 'head' as const, email: 'head@customreport.local' },
  admin: { role: 'admin' as const, email: 'admin@customreport.local' },
};

type LogEntry = {
  type: 'response' | 'requestfailed' | 'pageerror';
  url?: string;
  status?: number;
  method?: string;
  message?: string;
};

test.describe.serial('PRODUCT-READY — progressive role lifecycle', () => {
  test('PR-001 — clean fixture covers viewer, lead, head, admin and evidence capture', async ({
    page,
  }) => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const logs: LogEntry[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/trpc/') || url.includes('/health/')) {
        logs.push({
          type: 'response',
          method: response.request().method(),
          url,
          status: response.status(),
        });
      }
    });
    page.on('requestfailed', (request) => {
      logs.push({
        type: 'requestfailed',
        method: request.method(),
        url: request.url(),
        message: request.failure()?.errorText,
      });
    });
    page.on('pageerror', (error) => {
      logs.push({ type: 'pageerror', message: error.message });
    });

    await loginByCookie(page, {
      ...USERS.admin,
      redirect: '/admin',
    });
    await wipeAndReseed(page, 'advanced');

    const ready = await page.request.get(`${API}/health/ready`);
    expect(ready.ok(), 'API readiness after wipe/reseed').toBeTruthy();

    await loginByCookie(page, {
      ...USERS.viewer,
      redirect: '/reports?tab=published',
    });
    await page.goto(`${WEB}/reports?tab=published`);
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Published' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: /Admin|Dashboard|My Report/ })).toHaveCount(0);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '01-viewer-published-archive.png'),
      fullPage: true,
    });

    await loginByCookie(page, {
      ...USERS.lead,
      redirect: '/lead/report',
    });
    await page.goto(`${WEB}/lead/report`);
    await expect(page.getByRole('button', { name: /Product Status/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Current Week/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Next Week/i }).first()).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '02-lead-report-form.png'),
      fullPage: true,
    });

    await loginByCookie(page, {
      ...USERS.head,
      redirect: '/head/dashboard',
    });
    await page.goto(`${WEB}/head/dashboard`);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Lead Reports')).toBeVisible();
    const leadLink = page
      .locator('a[href*="/head/report/"][href*="authorId="]')
      .first();
    await expect(leadLink).toBeVisible();
    await expect(leadLink).toHaveCSS('cursor', 'pointer');
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '03-head-dashboard.png'),
      fullPage: true,
    });

    await leadLink.click();
    await page.waitForURL(/\/head\/report\/.+authorId=/);
    await expect(page.getByText(/Live\s+·\s+\d+\/\d+\s+Submitted/)).toBeVisible();
    const exportPdf = page.getByRole('button', { name: 'Export PDF' });
    if (await exportPdf.isDisabled()) {
      await expect(exportPdf).toHaveAttribute('title', 'Publish the report first');
    } else {
      await expect(exportPdf).toBeEnabled();
    }
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '04-head-author-report.png'),
      fullPage: true,
    });

    await page.goto(`${WEB}/head/report/${ACTIVE_REPORT_ID}`);
    const noContentSection = page
      .getByText('No content submitted for this product.')
      .first();
    if (await noContentSection.isVisible().catch(() => false)) {
      const disabledHeader = noContentSection.locator('..').locator('button').first();
      await expect(disabledHeader).toBeDisabled();
    }
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '05-weekly-report-products.png'),
      fullPage: true,
    });

    await loginByCookie(page, {
      ...USERS.admin,
      redirect: '/admin?tab=users',
    });
    await page.goto(`${WEB}/admin?tab=users`);
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
    await expect(page.getByLabel('Users tab')).toHaveAttribute('aria-current', 'page');
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '06-admin-users.png'),
      fullPage: true,
    });

    await page.goto(`${WEB}/admin?tab=products`);
    await expect(page.getByLabel('Products tab')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('products-table')).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '07-admin-products.png'),
      fullPage: true,
    });

    await page.goto(`${WEB}/admin?tab=reminders`);
    await expect(page.getByLabel('Reminders tab')).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByText('Configure automatic email reminders for report submissions'),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '08-admin-reminders.png'),
      fullPage: true,
    });

    await page.goto(`${WEB}/admin?tab=jobs`);
    await expect(page.getByLabel('Jobs tab')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('jobs-tab')).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '09-admin-jobs.png'),
      fullPage: true,
    });

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'network-and-page-log.json'),
      JSON.stringify(logs, null, 2),
    );

    const failedRequests = logs.filter(
      (entry) =>
        entry.type === 'requestfailed' && entry.message !== 'net::ERR_ABORTED',
    );
    const serverErrors = logs.filter(
      (entry) => entry.type === 'response' && (entry.status ?? 0) >= 500,
    );
    const pageErrors = logs.filter((entry) => entry.type === 'pageerror');

    expect(failedRequests, 'no failed browser requests').toEqual([]);
    expect(serverErrors, 'no 5xx API/browser responses').toEqual([]);
    expect(pageErrors, 'no uncaught page errors').toEqual([]);
  });
});

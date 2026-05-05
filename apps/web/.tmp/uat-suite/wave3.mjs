// Wave 3 — Mockup v14 visual parity: side-by-side production vs mockup screenshots
import { chromium, devices } from '@playwright/test';
import {
  BASE, ACCOUNTS,
  pass, fail, note,
  loginAs, shot, runTest,
} from './helpers.mjs';

const MOCKUP_URL = 'file:///Users/ap/work/customreport/mockups/cutom_report_maket_mockup-v17-v14.html';

note('Wave 3 start — mockup v14 visual parity');
const browser = await chromium.launch({ headless: true });

// Capture mockup at given anchor + viewport
async function captureMockup(id, anchor, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${MOCKUP_URL}${anchor}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  // Force scrollIntoView in case # nav was ignored
  if (anchor) {
    const id = anchor.replace('#', '');
    await page.evaluate((sid) => {
      const el = document.getElementById(sid);
      if (el) el.scrollIntoView({ block: 'start' });
    }, id);
    await page.waitForTimeout(400);
  }
  await page.screenshot({
    path: `/Users/ap/work/customreport/apps/web/.tmp/uat-screenshots/${id}-mockup.png`,
    fullPage: false,
  });
  await ctx.close();
}

// Capture production at given route + viewport (logged in as account)
async function captureProd(id, path, account, viewport, prep) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await loginAs(page, account.role, account.email);
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  if (prep) await prep(page);
  await page.screenshot({
    path: `/Users/ap/work/customreport/apps/web/.tmp/uat-screenshots/${id}-prod.png`,
    fullPage: false,
  });
  await ctx.close();
}

const captures = [
  // Lead form — desktop + mobile
  { id: 'MOCK-01', label: 'Lead form (desktop)', anchor: '#s1', path: '/lead/report', acct: ACCOUNTS.olga, viewport: { width: 1440, height: 900 } },
  { id: 'MOCK-02', label: 'Lead form (mobile)', anchor: '#s1', path: '/lead/report', acct: ACCOUNTS.olga, viewport: { width: 390, height: 844, isMobile: true, hasTouch: true } },
  // Lead form — Stage popover open (interactive state)
  { id: 'MOCK-03', label: 'Lead form Stage popover', anchor: '#s7', path: '/lead/report', acct: ACCOUNTS.olga, viewport: { width: 1440, height: 900 },
    prep: async (page) => { const c = page.getByRole('button', { name: /Dev: at-risk/i }).first(); if (await c.count() > 0) { await c.click(); await page.waitForTimeout(500); } } },
  // Lead form — Risk dialog open
  { id: 'MOCK-04', label: 'Risk dialog', anchor: '#s7', path: '/lead/report', acct: ACCOUNTS.olga, viewport: { width: 1440, height: 900 },
    prep: async (page) => { const b = page.getByRole('button', { name: /\+ Add Risk/i }).first(); if (await b.count() > 0) { await b.click(); await page.waitForTimeout(500); } } },
  // Dashboard — desktop + mobile
  { id: 'MOCK-05', label: 'Dashboard (desktop)', anchor: '#s2', path: '/head/dashboard', acct: ACCOUNTS.head, viewport: { width: 1440, height: 900 } },
  { id: 'MOCK-06', label: 'Dashboard (mobile)', anchor: '#s2', path: '/head/dashboard', acct: ACCOUNTS.head, viewport: { width: 390, height: 844, isMobile: true, hasTouch: true } },
  // Weekly report (head)
  { id: 'MOCK-07', label: 'Weekly Report', anchor: '#s3', path: '/head/report', acct: ACCOUNTS.head, viewport: { width: 1440, height: 900 } },
  // Admin — users tab
  { id: 'MOCK-08', label: 'Admin Users', anchor: '#s4', path: '/admin?tab=users', acct: ACCOUNTS.head, viewport: { width: 1440, height: 900 } },
  // Admin — products tab (stage assignments)
  { id: 'MOCK-09', label: 'Admin Products', anchor: '#s4', path: '/admin?tab=products', acct: ACCOUNTS.head, viewport: { width: 1440, height: 900 } },
  // Archive
  { id: 'MOCK-10', label: 'Archive', anchor: '#s2', path: '/reports/history', acct: ACCOUNTS.head, viewport: { width: 1440, height: 900 } },
  // Print
  { id: 'MOCK-11', label: 'Print page', anchor: '#s7', path: null, acct: ACCOUNTS.head, viewport: { width: 1440, height: 900 } }, // path resolved below
  // Trends (no mockup section but capture prod anyway)
  { id: 'MOCK-12', label: 'Trends', anchor: '#s2', path: '/reports/trends', acct: ACCOUNTS.head, viewport: { width: 1440, height: 900 } },
];

// Resolve print path
const reportId = (await import('node:child_process')).execSync(
  `docker exec customreport-postgres-1 psql -U customreport -d customreport -tAc "SELECT id FROM \\"Report\\" WHERE \\"weekLabel\\"='Week 15' LIMIT 1"`,
  { encoding: 'utf8' },
).trim();
captures.find((c) => c.id === 'MOCK-11').path = `/reports/${reportId}/print`;

for (const c of captures) {
  await runTest(c.id, async () => {
    await captureMockup(c.id, c.anchor, { width: c.viewport.width, height: c.viewport.height });
    await captureProd(c.id, c.path, c.acct, c.viewport, c.prep);
    pass(c.id, `Captured ${c.label} (${c.viewport.width}x${c.viewport.height})`);
  });
}

await browser.close();
note('Wave 3 done');

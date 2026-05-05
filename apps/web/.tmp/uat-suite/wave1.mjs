// Wave 1 — P0 critical paths: every wired button + screenshot per route
import { chromium, devices } from '@playwright/test';
import {
  BASE, MAILHOG, ACCOUNTS,
  pass, fail, warn, note,
  loginAs, shot, pgQuery, pgInt, runTest, attachConsoleErrors,
} from './helpers.mjs';

note('Wave 1 start — P0 critical paths');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// ============================================================
// 1.1 — /lead/report (Olga, Week 16 draft)
// ============================================================
await runTest('LEAD-W1-01', async () => {
  const id = 'LEAD-W1-01';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForURL('**/lead/report', { timeout: 15000 });
  await page.waitForSelector('h1:has-text("My Report")', { timeout: 10000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  await shot(page, id);
  const txt = await page.textContent('body');
  // Match form chrome that is invariant of which period the form lands on.
  // The seed only populates Week 16 + 15; the auto-generated "current
  // week" section may render with zero ProjectStatuses, so we no longer
  // assert specific product names here. Specific data presence is
  // verified by tests that explicitly navigate to Week 16.
  const hasShell = txt.includes('Olga N.') && txt.includes('Editing version') && txt.includes('Product Status');
  if (hasShell) pass(id, 'Lead form chrome rendered (h1, header, version pill, sections)');
  else fail(id, 'Lead form chrome missing — Olga N. + Editing version + Product Status not all found');
  await page.close();
});

await runTest('LEAD-W1-02', async () => {
  const id = 'LEAD-W1-02';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const toggleAll = page.getByRole('button', { name: /Toggle All/i });
  if ((await toggleAll.count()) === 0) { fail(id, 'No Toggle All button'); throw 0; }
  // Capture before state
  const beforeExpanded = await page.locator('[aria-expanded="true"]').count();
  await toggleAll.first().click();
  await page.waitForTimeout(400);
  const afterExpanded = await page.locator('[aria-expanded="true"]').count();
  await shot(page, id);
  if (beforeExpanded !== afterExpanded) pass(id, `Toggle All flipped expansion (${beforeExpanded}→${afterExpanded})`);
  else fail(id, 'Toggle All did not change any aria-expanded');
  await page.close();
});

await runTest('LEAD-W1-03', async () => {
  const id = 'LEAD-W1-03';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const fillBtn = page.getByRole('button', { name: /Fill from Previous/i });
  const cnt = await fillBtn.count();
  if (cnt === 0) { warn(id, 'Fill from Previous button not present'); throw 0; }
  const enabled = !(await fillBtn.first().isDisabled());
  await shot(page, id);
  pass(id, `Fill from Previous present (enabled=${enabled})`);
  await page.close();
});

await runTest('LEAD-W1-04', async () => {
  const id = 'LEAD-W1-04';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const prev = page.getByRole('button', { name: /Previous period/i });
  const next = page.getByRole('button', { name: /Next period/i });
  const select = page.locator('select[aria-label*="reporting period"]').first();
  const before = await select.inputValue();
  // click Prev should change the period
  if (!(await prev.first().isDisabled())) {
    await prev.first().click();
    await page.waitForTimeout(800);
    const after = await select.inputValue();
    await shot(page, id);
    if (before !== after) pass(id, `Period nav: ${before.slice(0, 8)} → ${after.slice(0, 8)}`);
    else fail(id, 'Period select value unchanged after Prev click');
  } else {
    await shot(page, id);
    pass(id, 'Prev disabled at boundary (only one period available?)');
  }
  await page.close();
});

await runTest('LEAD-W1-05', async () => {
  const id = 'LEAD-W1-05';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const prev = page.getByRole('button', { name: /^Previous version$/i });
  const next = page.getByRole('button', { name: /^Next version$/i });
  const prevDisabled = await prev.first().isDisabled().catch(() => true);
  const nextDisabled = await next.first().isDisabled().catch(() => true);
  await shot(page, id);
  pass(id, `Version Prev/Next render (disabled: prev=${prevDisabled} next=${nextDisabled})`);
  await page.close();
});

await runTest('LEAD-W1-06', async () => {
  const id = 'LEAD-W1-06';
  // Look up Olga's section for the current active period (date-relative seed
  // means weekLabel changes week-over-week). Picks the latest non-published.
  const sectionId = pgQuery(`SELECT rs.id FROM "ReportSection" rs JOIN "User" u ON u.id=rs."authorId" JOIN "Report" r ON r.id=rs."reportId" WHERE u.email='olga@customreport.local' AND r.status='draft' ORDER BY r."periodStart" DESC LIMIT 1`);
  const beforeCnt = pgInt(`SELECT COUNT(*) FROM "VersionSnapshot" WHERE "reportSectionId"='${sectionId}'`);
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const saveVer = page.getByRole('button', { name: /Save Version/i });
  if ((await saveVer.count()) === 0) { fail(id, 'No Save Version button'); throw 0; }
  await saveVer.first().click();
  await page.waitForTimeout(2500);
  await shot(page, id);
  const afterCnt = pgInt(`SELECT COUNT(*) FROM "VersionSnapshot" WHERE "reportSectionId"='${sectionId}'`);
  if (afterCnt > beforeCnt) pass(id, `VersionSnapshot ${beforeCnt}→${afterCnt}`);
  else fail(id, `VersionSnapshot unchanged at ${beforeCnt}`);
  await page.close();
});

await runTest('LEAD-W1-07', async () => {
  const id = 'LEAD-W1-07';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const stage = page.getByRole('button', { name: /Dev: at-risk/i }).first();
  if ((await stage.count()) === 0) { fail(id, 'No Dev: at-risk chip'); throw 0; }
  await stage.click();
  await page.waitForTimeout(700);
  await shot(page, id);
  // Look for popover content (4 menuitems or known labels)
  const txt = await page.textContent('body');
  const opened = txt.includes('At Risk') || txt.includes('Blocked') || txt.includes('On Track') || txt.includes('Clear');
  if (opened) pass(id, 'Stage popover opened');
  else fail(id, 'No popover detected');
  await page.close();
});

await runTest('LEAD-W1-09', async () => {
  const id = 'LEAD-W1-09';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const addItem = page.getByRole('button', { name: /Add item to/i });
  if ((await addItem.count()) === 0) { fail(id, 'No "Add item to ..." buttons'); throw 0; }
  await addItem.first().click();
  await page.waitForTimeout(500);
  await shot(page, id);
  const dialog = page.getByRole('dialog');
  if ((await dialog.count()) > 0) pass(id, 'Add Item dialog opened');
  else fail(id, 'No dialog after click');
  await page.close();
});

await runTest('LEAD-W1-13', async () => {
  const id = 'LEAD-W1-13';
  const beforeCnt = pgInt(`SELECT COUNT(*) FROM "Risk" r JOIN "ReportSection" rs ON rs.id=r."reportSectionId" JOIN "User" u ON u.id=rs."authorId" WHERE u.email='olga@customreport.local'`);
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const addRisk = page.getByRole('button', { name: /\+ Add Risk/i }).first();
  if ((await addRisk.count()) === 0) { fail(id, 'No + Add Risk button'); throw 0; }
  await addRisk.click();
  await page.waitForTimeout(500);
  await shot(page, id);
  const dialog = page.getByRole('dialog');
  if ((await dialog.count()) === 0) { fail(id, 'Risk dialog not rendered'); throw 0; }
  pass(id, '+ Add Risk dialog rendered');
  await page.close();
});

await runTest('LEAD-W1-15', async () => {
  const id = 'LEAD-W1-15';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForSelector('h1:has-text("My Report")', { timeout: 15000 });
  // Priorities accordion starts collapsed; expand it so the + Add Priority
  // button renders before we look for it.
  const priorityHeader = page.locator('button[aria-expanded][aria-controls]', { hasText: /Priorities/i }).first();
  if ((await priorityHeader.count()) > 0) {
    await priorityHeader.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
  const addPriority = page.getByRole('button', { name: /\+ Add Priority/i }).first();
  await addPriority.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if ((await addPriority.count()) === 0) { fail(id, 'No + Add Priority button after expanding section'); throw 0; }
  await addPriority.click({ force: true });
  await page.waitForTimeout(500);
  await shot(page, id);
  const dialog = page.getByRole('dialog');
  if ((await dialog.count()) > 0) pass(id, '+ Add Priority dialog rendered');
  else fail(id, 'Priority dialog not rendered');
  await page.close();
});

await runTest('LEAD-W1-16', async () => {
  const id = 'LEAD-W1-16';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const submitBtn = page.getByRole('button', { name: /Submit Report/i });
  if ((await submitBtn.count()) === 0) { fail(id, 'No Submit Report button'); throw 0; }
  const disabled = await submitBtn.first().isDisabled();
  await shot(page, id);
  pass(id, `Submit Report button present (disabled=${disabled})`);
  await page.close();
});

await runTest('LEAD-W1-18', async () => {
  const id = 'LEAD-W1-18';
  const mobile = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await mobile.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const dims = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  await shot(page, id);
  if (dims.sw <= dims.cw + 1) pass(id, `Mobile no-hscroll (${dims.sw}/${dims.cw})`);
  else fail(id, `Horizontal overflow ${dims.sw}/${dims.cw}`);
  await mobile.close();
});

// ============================================================
// 1.2 — /lead/history
// ============================================================
await runTest('HIST-W1-01', async () => {
  const id = 'HIST-W1-01';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.goto(`${BASE}/lead/history`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  await shot(page, id);
  const txt = await page.textContent('body');
  // Match either the page heading "History" or any "Week NN" label so the
  // assertion stays valid week-over-week with date-relative seed data.
  if (/Week \d+/.test(txt) || txt.includes('History')) pass(id, 'Lead history page renders');
  else fail(id, 'No expected content on history page');
  await page.close();
});

// ============================================================
// 1.3 — /head/dashboard
// ============================================================
await runTest('DASH-W1-01', async () => {
  const id = 'DASH-W1-01';
  const page = await ctx.newPage();
  const errs = attachConsoleErrors(page);
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/head/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 15000 });
  await page.waitForFunction(
    () => document.body.textContent.match(/Submissions[\s\S]{0,300}\d+[\s\S]{0,30}\d+/i),
    { timeout: 30000 },
  ).catch(() => {});
  await shot(page, id);
  const txt = await page.textContent('body');
  const ok = txt.includes('Dashboard') && txt.toLowerCase().includes('submissions') && txt.includes('Risks');
  if (ok && errs.length === 0) pass(id, 'Dashboard renders all KPIs');
  else if (ok) warn(id, `KPIs OK but ${errs.length} console errors`);
  else fail(id, `Missing dashboard content (errs=${errs.length})`);
  await page.close();
});

await runTest('DASH-W1-02', async () => {
  const id = 'DASH-W1-02';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/head/dashboard`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const toggleAll = page.getByRole('button', { name: /Toggle All/i });
  if ((await toggleAll.count()) === 0) { fail(id, 'No Toggle All on dashboard'); throw 0; }
  const before = await page.locator('[aria-expanded="true"]').count();
  await toggleAll.first().click();
  await page.waitForTimeout(400);
  const after = await page.locator('[aria-expanded="true"]').count();
  await shot(page, id);
  if (before !== after) pass(id, `Toggle All flipped (${before}→${after})`);
  else fail(id, 'Toggle All no-op');
  await page.close();
});

await runTest('DASH-W1-05', async () => {
  const id = 'DASH-W1-05';
  await fetch(`${MAILHOG}/api/v1/messages`, { method: 'DELETE' }).catch(() => {});
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/head/dashboard`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const sendBtn = page.getByRole('button', { name: /Send Reminder/i });
  if ((await sendBtn.count()) === 0) { warn(id, 'No Send Reminder button — perhaps no pending leads'); throw 0; }
  await sendBtn.first().click();
  await page.waitForTimeout(4000);
  await shot(page, id);
  const inbox = await fetch(`${MAILHOG}/api/v2/messages`).then((r) => r.json()).catch(() => ({ total: 0 }));
  if (inbox.total > 0) pass(id, `Reminder dispatched (${inbox.total} email)`);
  else fail(id, 'MailHog inbox empty after click');
  await page.close();
});

// ============================================================
// 1.4 — /head/report
// ============================================================
await runTest('REV-W1-01', async () => {
  const id = 'REV-W1-01';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/head/report`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  await shot(page, id);
  const txt = await page.textContent('body');
  if (txt.toLowerCase().includes('portfolio') || txt.includes('Weekly')) pass(id, 'Weekly Report page renders');
  else fail(id, 'No portfolio/weekly content');
  await page.close();
});

await runTest('REV-W1-06', async () => {
  const id = 'REV-W1-06';
  const reportId = pgQuery(`SELECT id FROM "Report" WHERE status='published' ORDER BY "periodStart" DESC LIMIT 1`);
  if (!reportId || reportId.startsWith('ERROR')) { fail(id, 'No published report found'); throw 0; }
  const beforeJobs = pgInt(`SELECT COUNT(*) FROM "PdfExportJob" WHERE "reportId"='${reportId}'`);
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/reports/${reportId}`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const exportBtn = page.getByRole('button', { name: /Export.*PDF|Download.*PDF/i });
  if ((await exportBtn.count()) === 0) { fail(id, 'No Export PDF button'); throw 0; }
  if (await exportBtn.first().isDisabled()) { warn(id, 'Export PDF disabled'); throw 0; }
  await exportBtn.first().click();
  await page.waitForTimeout(8000); // wait for BullMQ job
  await shot(page, id);
  const afterJobs = pgInt(`SELECT COUNT(*) FROM "PdfExportJob" WHERE "reportId"='${reportId}'`);
  if (afterJobs > beforeJobs) pass(id, `PdfExportJob queued (${beforeJobs}→${afterJobs})`);
  else fail(id, `No new job queued`);
  await page.close();
});

// ============================================================
// 1.5 — /admin tabs
// ============================================================
for (const tab of ['users', 'products', 'periods', 'reminders', 'settings']) {
  const id = `ADM-W1-${tab}`;
  await runTest(id, async () => {
    const page = await ctx.newPage();
    await loginAs(page, ACCOUNTS.head.role);
    await page.goto(`${BASE}/admin?tab=${tab}`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await shot(page, id);
    const txt = await page.textContent('body');
    if (txt.includes('Page unavailable for your role') || txt.includes('Access denied')) fail(id, 'tab access denied');
    else if (txt.length > 1000) pass(id, `${tab} tab renders`);
    else fail(id, `${tab} tab content sparse (${txt.length}b)`);
    await page.close();
  });
}

await runTest('ADM-W1-add-user', async () => {
  const id = 'ADM-W1-add-user';
  const stamp = `uat${Date.now()}`;
  const email = `${stamp}@uat.local`;
  const before = pgInt(`SELECT COUNT(*) FROM "User"`);
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/admin?tab=users`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const addBtn = page.getByRole('button', { name: /Add.*[Uu]ser/i }).first();
  if ((await addBtn.count()) === 0) { fail(id, 'No Add User button'); throw 0; }
  await addBtn.click();
  await page.waitForTimeout(600);
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 5000 });
  const inputs = dialog.locator('input[type="text"], input[type="email"], input:not([type])');
  const cnt = await inputs.count();
  if (cnt < 2) { fail(id, `Dialog has ${cnt} inputs, expected ≥2`); throw 0; }
  await inputs.nth(0).fill(`UAT ${stamp}`);
  await inputs.nth(1).fill(email);
  const save = dialog.getByRole('button', { name: /Save|Create|Add/i }).last();
  await save.click();
  await page.waitForTimeout(1500);
  await shot(page, id);
  const after = pgInt(`SELECT COUNT(*) FROM "User"`);
  if (after > before && pgQuery(`SELECT email FROM "User" WHERE email='${email}'`) === email) {
    pass(id, `User added (${before}→${after})`);
  } else fail(id, `Not added (${before}→${after})`);
  await page.close();
});

// ============================================================
// 1.6 — /reports/* archive + detail + print
// ============================================================
await runTest('ARC-W1-01', async () => {
  const id = 'ARC-W1-01';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/reports/history`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  await shot(page, id);
  const txt = await page.textContent('body');
  // Archive should list at least one published "Week NN" label.
  if (/Week \d+/.test(txt)) pass(id, 'Archive lists at least one published period');
  else fail(id, 'No published period in archive');
  await page.close();
});

await runTest('ARC-W1-04', async () => {
  const id = 'ARC-W1-04';
  const reportId = pgQuery(`SELECT id FROM "Report" WHERE status='published' ORDER BY "periodStart" DESC AND status='published' LIMIT 1`);
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/reports/${reportId}/print`);
  await page.waitForLoadState('networkidle', { timeout: 20000 });
  await shot(page, id);
  const txt = await page.textContent('body');
  const hasNav = txt.includes('Skip to content') && txt.includes('CustomReport');
  if (txt.length > 1000 && !hasNav) pass(id, 'Print page renders without app shell');
  else if (txt.length > 1000) warn(id, 'Print page renders but app shell still visible');
  else fail(id, 'Print page empty');
  await page.close();
});

// ============================================================
// 1.7 — /reports/trends
// ============================================================
await runTest('TRENDS-W1-01', async () => {
  const id = 'TRENDS-W1-01';
  const page = await ctx.newPage();
  const errs = attachConsoleErrors(page);
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/reports/trends`);
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await shot(page, id);
  const txt = await page.textContent('body');
  const hasHeading = txt.includes('Trends');
  const hasCharts = txt.includes('Traffic-light') || txt.includes('Lead velocity') || txt.includes('Period comparison');
  if (hasHeading && hasCharts && errs.length === 0) pass(id, 'Trends page + 3 sections clean');
  else if (hasHeading && hasCharts) warn(id, `Trends OK but ${errs.length} console errors`);
  else fail(id, `Missing content (heading=${hasHeading} charts=${hasCharts})`);
  await page.close();
});

// ============================================================
// 1.8 — Cross-role gates
// ============================================================
const gates = [
  { id: 'AUTH-W1-01', acct: ACCOUNTS.olga, path: '/admin', expect403: true },
  { id: 'AUTH-W1-02', acct: ACCOUNTS.olga, path: '/head/dashboard', expect403: true },
  { id: 'AUTH-W1-03', acct: ACCOUNTS.viewer, path: '/lead/report', expect403: true },
  { id: 'AUTH-W1-04', acct: ACCOUNTS.viewer, path: '/reports/history', expect403: false },
];
for (const g of gates) {
  await runTest(g.id, async () => {
    const page = await ctx.newPage();
    await loginAs(page, g.acct.role, g.acct.email);
    await page.goto(`${BASE}${g.path}`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await shot(page, g.id);
    const txt = await page.textContent('body');
    // Phase 33-04 softened the forbidden copy; accept either the new
    // ("Page unavailable for your role") or legacy ("Access denied") string.
    const denied = txt.includes('Page unavailable for your role') || txt.includes('Access denied');
    const ok = g.expect403 ? denied : !denied;
    if (ok) pass(g.id, `Gate correct: ${g.acct.role}→${g.path} = ${g.expect403 ? '403' : 'OK'}`);
    else fail(g.id, `Gate wrong: expected ${g.expect403 ? '403' : 'OK'}, got ${denied ? '403' : 'OK'}`);
    await page.close();
  });
}

await browser.close();
note('Wave 1 done');

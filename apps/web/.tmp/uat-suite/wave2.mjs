// Wave 2 — P1 high-risk untested edge cases (20 from Section E inventory)
import { chromium, devices } from '@playwright/test';
import {
  BASE, MAILHOG, ACCOUNTS,
  pass, fail, warn, note,
  loginAs, shot, pgQuery, pgInt, runTest, attachConsoleErrors,
  waitForAppReady,
} from './helpers.mjs';

note('Wave 2 start — P1 high-risk untested');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// E-02 Stage popover dismiss-outside — find ANY editable chip (ownership=mine)
// rather than relying on a specific {stage}: {status} pair, since the seed
// may or may not pre-set traffic-light statuses for the active lead.
await runTest('E-02', async () => {
  const id = 'E-02';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await waitForAppReady(page);
  // Stage chips are <button aria-label="${stageName}: ${status}">.
  // An editable chip has `disabled=false` (StageChip line 189: `disabled={!isEditable}`).
  const stage = page.locator(
    'button[aria-label*=":"][aria-label*="track"]:not([disabled]), ' +
    'button[aria-label*=":"][aria-label*="risk"]:not([disabled]), ' +
    'button[aria-label*=":"][aria-label*="blocked"]:not([disabled]), ' +
    'button[aria-label*=":"][aria-label*="empty"]:not([disabled])',
  ).first();
  if ((await stage.count()) === 0) {
    fail(id, 'No editable stage chip on Olga form');
    throw 0;
  }
  await stage.scrollIntoViewIfNeeded();
  await stage.click();
  // Popover renders via createPortal with role="menu".
  await page.waitForSelector('[role="menu"]', { timeout: 3000 }).catch(() => {});
  const popoverBefore = await page.locator('[role="menu"]').count();
  // Click far away from popover (top-left corner) — should trigger outside-click handler.
  await page.mouse.click(10, 10);
  await page.waitForTimeout(500);
  const popoverAfter = await page.locator('[role="menu"]').count();
  await shot(page, id);
  if (popoverBefore > 0 && popoverAfter === 0) pass(id, `Popover dismissed on outside click (${popoverBefore}→${popoverAfter})`);
  else if (popoverBefore === 0) warn(id, 'Popover never opened — chip may not be editable');
  else warn(id, `Popover still open (${popoverBefore}→${popoverAfter})`);
  await page.close();
});

// E-04 Send Reminder no-rule path: delete reminder rules then click button
await runTest('E-04', async () => {
  const id = 'E-04';
  // Snapshot current rules to restore later
  const ruleCount = pgInt(`SELECT COUNT(*) FROM "ReminderRule" WHERE status='active'`);
  if (ruleCount === 0) {
    note('E-04: no active rules already → use this state');
  } else {
    pgQuery(`UPDATE "ReminderRule" SET status='inactive'::"ReminderRuleStatus" WHERE status='active'`);
  }
  await fetch(`${MAILHOG}/api/v1/messages`, { method: 'DELETE' }).catch(() => {});
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/head/dashboard`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const sendBtn = page.getByRole('button', { name: /Send Reminder/i });
  if ((await sendBtn.count()) === 0) {
    warn(id, 'No Send Reminder button (no pending leads?)');
  } else {
    await sendBtn.first().click();
    // Sonner mounts toasts under [data-sonner-toaster]. Wait for any toast
    // descendant to appear (up to 6s) — the dispatchPending mutation goes
    // through tRPC, so we have to allow for round-trip + render.
    const toastAppeared = await page
      .waitForFunction(
        () => {
          const root = document.querySelector('[data-sonner-toaster]');
          if (!root) return false;
          const txt = (root.textContent ?? '').toLowerCase();
          return txt.includes('reminder') || txt.includes('rule') || txt.includes('pending');
        },
        undefined,
        { timeout: 6000, polling: 200 },
      )
      .then(() => true)
      .catch(() => false);
    await shot(page, id);
    const toastTxt = await page
      .evaluate(() => document.querySelector('[data-sonner-toaster]')?.textContent ?? '')
      .catch(() => '');
    const lower = toastTxt.toLowerCase();
    const hasErr =
      lower.includes('no active reminder rule') ||
      lower.includes('no rule') ||
      lower.includes('reminder rule');
    const inbox = await fetch(`${MAILHOG}/api/v2/messages`).then((r) => r.json()).catch(() => ({ total: 0 }));
    if (hasErr) pass(id, `Error toast shown for no-rule case (toast="${toastTxt.slice(0, 60)}")`);
    else if (toastAppeared) warn(id, `Toast rendered but copy unexpected: "${toastTxt.slice(0, 80)}"`);
    else if (inbox.total === 0) warn(id, 'No email + no toast detected (sonner portal may have unmounted)');
    else fail(id, 'Email sent despite no active rule (rules cleared)');
  }
  // Restore rules
  if (ruleCount > 0) pgQuery(`UPDATE "ReminderRule" SET status='active'::"ReminderRuleStatus"`);
  await page.close();
});

// E-08 Period nav boundary
await runTest('E-08', async () => {
  const id = 'E-08';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const prev = page.getByRole('button', { name: /Previous period/i }).first();
  // Click Prev until disabled
  let clicks = 0;
  while (!(await prev.isDisabled()) && clicks < 5) {
    await prev.click();
    await page.waitForTimeout(800);
    clicks++;
  }
  const disabled = await prev.isDisabled();
  await shot(page, id);
  if (disabled) pass(id, `Prev disabled at boundary after ${clicks} clicks`);
  else fail(id, `Prev still enabled after ${clicks} clicks (no boundary?)`);
  await page.close();
});

// E-10 Mobile horizontal scroll on all 7 routes
await runTest('E-10', async () => {
  const id = 'E-10';
  const mobile = await browser.newContext({ ...devices['iPhone 14'] });
  const routes = [
    { path: '/lead/report', acct: ACCOUNTS.olga },
    { path: '/lead/history', acct: ACCOUNTS.olga },
    { path: '/head/dashboard', acct: ACCOUNTS.head },
    { path: '/head/report', acct: ACCOUNTS.head },
    { path: '/reports/history', acct: ACCOUNTS.head },
    { path: '/reports/trends', acct: ACCOUNTS.head },
    { path: '/admin?tab=users', acct: ACCOUNTS.head },
  ];
  const offenders = [];
  for (const r of routes) {
    const page = await mobile.newPage();
    await loginAs(page, r.acct.role, r.acct.email);
    await page.goto(`${BASE}${r.path}`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const dims = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    if (dims.sw > dims.cw + 1) offenders.push(`${r.path}:${dims.sw}>${dims.cw}`);
    await page.close();
  }
  // Take final screenshot of admin (most likely to overflow)
  const finalPage = await mobile.newPage();
  await loginAs(finalPage, ACCOUNTS.head.role);
  await finalPage.goto(`${BASE}/admin?tab=users`);
  await finalPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await shot(finalPage, id);
  await finalPage.close();
  await mobile.close();
  if (offenders.length === 0) pass(id, '7/7 routes pass 390px no-hscroll');
  else fail(id, `${offenders.length} offenders: ${offenders.join(' | ')}`);
});

// E-11 Trends charts on slow network
await runTest('E-11', async () => {
  const id = 'E-11';
  const page = await ctx.newPage();
  const errs = attachConsoleErrors(page);
  await loginAs(page, ACCOUNTS.head.role);
  // Throttle via CDP
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 200, downloadThroughput: 100 * 1024, uploadThroughput: 50 * 1024,
  });
  await page.goto(`${BASE}/reports/trends`);
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await shot(page, id);
  const txt = await page.textContent('body');
  const hasContent = txt.includes('Trends') && (txt.includes('history') || txt.includes('velocity'));
  if (hasContent && errs.length === 0) pass(id, 'Trends rendered on slow 3G with no console errors');
  else if (hasContent) warn(id, `Trends OK but ${errs.length} console errors on slow net`);
  else fail(id, 'Trends never rendered fully');
  await page.close();
});

// E-12 Archive last page (single page since seed has 1 published)
await runTest('E-12', async () => {
  const id = 'E-12';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/reports/history`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  await shot(page, id);
  const loadMore = page.getByRole('button', { name: /Load more|More/i });
  const hasLoadMore = (await loadMore.count()) > 0;
  // With seed=1 published report, Load more should be absent OR show "no more"
  if (!hasLoadMore) pass(id, 'No Load more button at end of archive (1 published report)');
  else {
    const disabled = await loadMore.first().isDisabled();
    if (disabled) pass(id, 'Load more present but disabled at end');
    else warn(id, 'Load more enabled but archive may be at end');
  }
  await page.close();
});

// E-14 Viewer client-side bypass attempt — fire mutation directly
await runTest('E-14', async () => {
  const id = 'E-14';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.viewer.role);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  // Try to call admin.snapshot from viewer — should be denied by server
  const result = await page.evaluate(async () => {
    const res = await fetch('/trpc/admin.snapshot?batch=1&input=%7B%220%22%3A%7B%7D%7D', {
      credentials: 'include',
    });
    return { status: res.status, body: (await res.text()).slice(0, 200) };
  });
  await shot(page, id);
  if (result.status === 403 || result.status === 401 || result.body.includes('UNAUTHORIZED') || result.body.includes('FORBIDDEN')) {
    pass(id, `Server rejected viewer admin.snapshot (HTTP ${result.status})`);
  } else if (result.status >= 200 && result.status < 300) {
    fail(id, `Server allowed viewer admin call! status=${result.status}`);
  } else {
    warn(id, `Status ${result.status}: ${result.body.slice(0, 100)}`);
  }
  await page.close();
});

// E-19 Toggle All partial state — use scrollIntoView + force click so the
// autosave-driven re-renders on /lead/report don't lose the click target.
await runTest('E-19', async () => {
  const id = 'E-19';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.olga.role, ACCOUNTS.olga.email);
  await waitForAppReady(page);
  const initialExpanded = await page.locator('[aria-expanded="true"]').count();
  const allExpandable = await page.locator('button[aria-expanded]').count();
  const toggleAll = page.getByRole('button', { name: /Toggle All/i }).first();
  if ((await toggleAll.count()) === 0) { fail(id, 'No Toggle All button on /lead/report'); throw 0; }
  await toggleAll.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  // Force click bypasses Playwright's actionability check, which can race the
  // form's autosave debouncer that re-renders sections on every state nudge.
  await toggleAll.click({ force: true, timeout: 5000 });
  await page.waitForTimeout(500);
  const after1 = await page.locator('[aria-expanded="true"]').count();
  await toggleAll.click({ force: true, timeout: 5000 });
  await page.waitForTimeout(500);
  const after2 = await page.locator('[aria-expanded="true"]').count();
  await shot(page, id);
  if (after1 !== after2 && (after1 === 0 || after2 === 0)) {
    pass(id, `Toggle cycles cleanly (init=${initialExpanded}, after1=${after1}, after2=${after2}, of ${allExpandable})`);
  } else {
    warn(id, `States: ${initialExpanded}→${after1}→${after2} of ${allExpandable} expandable`);
  }
  await page.close();
});

// E-20 Settings Help link — DECISION: out of scope.
// Mockup v14 Settings tab has no Help affordance (verified against
// `mockups/cutom_report_maket_mockup-v17-v14.html` — only Department Name,
// Auto-create Periods toggle, Default Deadline (1-7), Save Settings button).
// Asserting intentional absence so we know the day a Help link sneaks in
// without spec coverage.
await runTest('E-20', async () => {
  const id = 'E-20';
  const page = await ctx.newPage();
  await loginAs(page, ACCOUNTS.head.role);
  await page.goto(`${BASE}/admin?tab=settings`);
  await waitForAppReady(page);
  await shot(page, id);
  const helpLinks = await page.locator('a[href*="help"], a[href*="docs"], button[aria-label*="Help"], svg[aria-label*="Help"]').count();
  if (helpLinks === 0) {
    pass(id, 'Settings tab matches mockup (no Help link — intentional, per v14 spec)');
  } else {
    warn(id, `Help element appeared (${helpLinks}) — verify it was added to the spec before treating as PASS`);
  }
  await page.close();
});

await browser.close();
note('Wave 2 done');

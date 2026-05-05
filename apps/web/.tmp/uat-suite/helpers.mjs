// Shared helpers for UAT suite — headless playwright + screenshots + db queries
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

export const BASE = 'http://localhost:3000';
export const API = 'http://localhost:3002';
export const MAILHOG = 'http://localhost:8025';
export const SCREENSHOTS_DIR = '/Users/ap/work/customreport/apps/web/.tmp/uat-screenshots';

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Stream protocol — one line per outcome → Monitor surfaces in chat
export function emit(id, status, msg, detail = '') {
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'WARN' ? '⚠' : '·';
  const line = `${icon} ${id} [${status}] ${msg}${detail ? ` — ${detail.slice(0, 200)}` : ''}`;
  process.stdout.write(line + '\n');
}
export const pass = (id, msg, detail = '') => emit(id, 'PASS', msg, detail);
export const fail = (id, msg, detail = '') => emit(id, 'FAIL', msg, detail);
export const warn = (id, msg, detail = '') => emit(id, 'WARN', msg, detail);
export const note = (msg) => process.stdout.write(`· ${msg}\n`);

// Wait for the React app to hydrate. Next.js dev mode lazy-compiles routes,
// so networkidle alone fires before client islands attach. We sniff for
// hydration markers the app guarantees:
//   - any [aria-expanded] (accordion / popover trigger), OR
//   - any [data-testid="hydrated"] OR <main id="main-content">, OR
//   - the DEV role switcher button (always present in dev builds).
// Falls through with a no-op on timeout — caller still gets whatever rendered.
export async function waitForAppReady(page, timeout = 12000) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('[aria-expanded]').length > 0 ||
        document.querySelectorAll('[data-testid="hydrated"]').length > 0 ||
        document.querySelectorAll('main#main-content').length > 0 ||
        document.body.innerText.includes('DEV: switch role') ||
        document.body.innerText.includes('Access denied'),
      undefined,
      { timeout, polling: 200 },
    )
    .catch(() => {});
}

export async function loginAs(page, role, email) {
  const url = email ? `${BASE}/auth/dev-login?role=${role}&email=${email}` : `${BASE}/auth/dev-login?role=${role}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  // dev-login redirects to a role-appropriate landing page; wait for that
  // landing page to fully hydrate so subsequent assertions don't race the
  // first compile in dev mode.
  await waitForAppReady(page);
}

// Capture a page screenshot. Always waits for hydration first so dev-mode
// lazy compile doesn't produce blank captures.
export async function shot(page, id, opts = { waitFor: true, fullPage: false }) {
  if (opts.waitFor !== false) {
    await waitForAppReady(page, 8000);
  }
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/${id}.png`,
    fullPage: opts.fullPage ?? false,
  });
}

// Read body innerText including portal-rendered toasts/dialogs.
// Sonner renders toasts via createPortal to <body>; textContent('body')
// works but can miss display:contents wrappers — innerText is the
// reliable choice.
export async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

// Query Postgres dev container — returns trimmed text or 'ERROR: ...'
export function pgQuery(sql) {
  try {
    return execSync(
      `docker exec customreport-postgres-1 psql -U customreport -d customreport -tAc "${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8' },
    ).trim();
  } catch (e) {
    return `ERROR: ${e.message.slice(0, 200)}`;
  }
}

export function pgInt(sql) {
  const v = pgQuery(sql);
  if (v.startsWith('ERROR')) return -1;
  return parseInt(v, 10) || 0;
}

// Wrap a test body so a thrown error becomes FAIL with the message.
// Skip-throw-protocol: throw 0 to short-circuit cleanly inside a try block.
export async function runTest(id, fn) {
  try {
    await fn();
  } catch (e) {
    if (e !== 0) fail(id, 'Exception: ' + (e?.message ?? String(e)).slice(0, 200));
  }
}

export function attachConsoleErrors(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message.slice(0, 150)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console.error: ${m.text().slice(0, 150)}`);
  });
  return errs;
}

// Seed accounts (per CLAUDE.md memory + .planning/memory/)
export const ACCOUNTS = {
  head: { role: 'head', email: 'head@customreport.local' },
  admin: { role: 'admin', email: undefined }, // dev-login synthesizes admin@customreport.local
  viewer: { role: 'viewer', email: undefined },
  olga: { role: 'lead', email: 'olga@customreport.local' }, // Week 16 draft
  polenkov: { role: 'lead', email: 'polenkov@customreport.local' }, // Week 16 submitted
  sergey: { role: 'lead', email: 'sergey@customreport.local' }, // Week 16 draft
};

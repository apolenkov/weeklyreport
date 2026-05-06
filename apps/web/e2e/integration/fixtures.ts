/**
 * Real-API auth fixtures for the integration suite.
 *
 * Each role-scoped fixture creates a fresh browser context, mints a real
 * session JWT cookie via GET /auth/dev-login, and yields the page. The
 * dev-login endpoint exists ONLY when AUTH_DEV_MODE=true on the API
 * (playwright.integration.config.ts sets this).
 *
 * The cookie installation path uses `page.context().request` (NOT the
 * top-level `request` fixture) because Playwright's top-level `request`
 * fixture has its own cookie jar that does NOT share with browser contexts.
 * `page.context().request` shares cookies with the page that uses it.
 */

import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from '@playwright/test';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3002}`;

export type Role = 'lead' | 'head' | 'viewer';

/**
 * Mints a real session JWT cookie via the dev-login endpoint and installs it
 * on the given context. Does NOT navigate the page — caller decides where
 * to go after the cookie is set.
 *
 * Implementation notes:
 *   - We use `context.request.get(...)` so the Set-Cookie lands on the
 *     browser context's cookie jar (shared with the Page).
 *   - maxRedirects: 0 — we want the cookie, not the redirect to the
 *     role-default frontend path. Playwright treats 302/303/307 as the
 *     success signal here.
 *   - We sanity-check the cookie was installed before yielding. If
 *     SameSite/Domain rules ever drop the cookie, this throws loudly
 *     instead of producing mysterious 401s in every downstream test.
 */
export async function loginAs(
  context: BrowserContext,
  opts: { role: Role; email?: string },
): Promise<void> {
  const url = new URL(`${API_URL}/auth/dev-login`);
  url.searchParams.set('role', opts.role);
  if (opts.email) url.searchParams.set('email', opts.email);

  const res = await context.request.get(url.toString(), { maxRedirects: 0 });
  const status = res.status();
  // Express `res.redirect` defaults to 302; accept 303/307 defensively.
  if (status !== 302 && status !== 303 && status !== 307) {
    throw new Error(
      `dev-login failed: HTTP ${status} - ${await res.text().catch(() => '<no body>')}`,
    );
  }

  const cookies = await context.cookies();
  if (!cookies.find((c) => c.name === 'customreport_session')) {
    throw new Error(
      'customreport_session cookie was not set after /auth/dev-login. ' +
        'Check AUTH_DEV_MODE=true on the API and that FRONTEND_URL matches the ' +
        'browser baseURL (cookie SameSite/Domain rules).',
    );
  }
}

type Fixtures = {
  /** Logged in as lead 1 (a submitted lead with full data). */
  leadPage: Page;
  /** Logged in as the seeded department head. */
  headPage: Page;
  /** Logged in as the seeded read-only viewer. */
  viewerPage: Page;
  /** Fresh context with NO cookie — for auth-guard tests. */
  unauthedPage: Page;
};

export const test = base.extend<Fixtures>({
  leadPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(context, {
      role: 'lead',
      email: 'lead1@customreport.local',
    });
    await use(page);
    await context.close();
  },
  headPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(context, { role: 'head' });
    await use(page);
    await context.close();
  },
  viewerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(context, { role: 'viewer' });
    await use(page);
    await context.close();
  },
  unauthedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };

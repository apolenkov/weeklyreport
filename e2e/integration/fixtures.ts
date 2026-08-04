/**
 * Real-API auth fixtures for the integration suite: each role-scoped fixture
 * creates a fresh browser context, mints a session JWT via /auth/dev-login,
 * and yields the page. dev-login mounts only when AUTH_DEV_MODE=true on the
 * API (playwright.integration.config.ts sets this).
 */

import type { DbRole } from "@customreport/shared";
import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test as base,
} from "@playwright/test";

import { withOwnedResource } from "./helpers/owned-resource";

const DEFAULT_API_PORT = 3002;
// Express `res.redirect` defaults to 302; 303/307 are accepted defensively.
const FOUND = 302;
const SEE_OTHER = 303;
const TEMPORARY_REDIRECT = 307;
const DEV_LOGIN_REDIRECT_STATUSES = new Set([
  FOUND,
  SEE_OTHER,
  TEMPORARY_REDIRECT,
]);

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  `http://127.0.0.1:${process.env.E2E_API_PORT ?? DEFAULT_API_PORT}`;

/**
 * Mints a session JWT cookie via dev-login and installs it on the given
 * context. Does NOT navigate — the caller decides where to go after the
 * cookie is set. Throws if no redirect or session cookie arrives.
 */
export async function loginAs(
  context: BrowserContext,
  opts: { role: DbRole; email?: string },
): Promise<void> {
  const url = new URL(`${API_URL}/auth/dev-login`);
  url.searchParams.set("role", opts.role);
  if (opts.email) url.searchParams.set("email", opts.email);

  const res = await context.request.get(url.toString(), { maxRedirects: 0 });
  const status = res.status();
  if (!DEV_LOGIN_REDIRECT_STATUSES.has(status)) {
    throw new Error(
      `dev-login failed: HTTP ${status} - ${await res.text().catch(() => "<no body>")}`,
    );
  }

  const cookies = await context.cookies();
  if (!cookies.find((c) => c.name === "customreport_session")) {
    throw new Error(
      "customreport_session cookie was not set after /auth/dev-login. " +
        "Check AUTH_DEV_MODE=true on the API and that FRONTEND_URL matches the " +
        "browser baseURL (cookie SameSite/Domain rules).",
    );
  }
}

interface Fixtures {
  /** Logged in as lead 1 (a submitted lead with full data). */
  leadPage: Page;
  /** Logged in as the seeded department head. */
  headPage: Page;
  /** Logged in as the seeded admin user — use for /admin/* routes. */
  adminPage: Page;
  /** Logged in as the seeded read-only viewer. */
  viewerPage: Page;
  /** Fresh context with NO cookie — for auth-guard tests. */
  unauthedPage: Page;
}

interface LoginOptions {
  role: DbRole;
  email?: string;
}

type UsePage<Result> = (page: Page) => Promise<Result>;

async function withContextPage<Result>(
  browser: Browser,
  setup: (context: BrowserContext) => Promise<void>,
  usePage: UsePage<Result>,
): Promise<Result> {
  return withOwnedResource(
    () => browser.newContext(),
    async (context) => {
      await setup(context);
      return usePage(await context.newPage());
    },
  );
}

export async function withAuthenticatedPage<Result>(
  browser: Browser,
  options: LoginOptions,
  usePage: UsePage<Result>,
): Promise<Result> {
  return withContextPage(
    browser,
    (context) => loginAs(context, options),
    usePage,
  );
}

export const test = base.extend<Fixtures>({
  leadPage: ({ browser }, use) =>
    withAuthenticatedPage(
      browser,
      { role: "lead", email: "lead1@customreport.local" },
      use,
    ),
  headPage: ({ browser }, use) =>
    withAuthenticatedPage(browser, { role: "head" }, use),
  adminPage: ({ browser }, use) =>
    withAuthenticatedPage(browser, { role: "admin" }, use),
  viewerPage: ({ browser }, use) =>
    withAuthenticatedPage(browser, { role: "viewer" }, use),
  unauthedPage: ({ browser }, use) =>
    withContextPage(browser, () => Promise.resolve(), use),
});

export { expect };

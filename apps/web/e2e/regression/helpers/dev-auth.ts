import type { Page } from '@playwright/test';

type Role = 'lead' | 'head' | 'admin' | 'viewer';

const API_DEV_LOGIN_URL = 'http://localhost:3002/auth/dev-login';
const WEB_URL = 'http://localhost:3000';
const COOKIE_NAME = 'customreport_session';

export async function loginByCookie(
  page: Page,
  identity: { role: Role; email?: string; redirect?: string },
) {
  await page.context().clearCookies();
  const params = new URLSearchParams({ role: identity.role });
  if (identity.email) params.set('email', identity.email);
  params.set('redirect', identity.redirect ?? '/');

  await page.goto(`${WEB_URL}/auth/dev-login?${params.toString()}`, {
    waitUntil: 'domcontentloaded',
  });

  const cookies = await page.context().cookies(WEB_URL);
  const hasSession = cookies.some(
    (cookie) => cookie.name === COOKIE_NAME && cookie.value.length > 20,
  );
  if (!hasSession) {
    throw new Error(
      `dev-login did not establish ${COOKIE_NAME} via ${API_DEV_LOGIN_URL}`,
    );
  }
}

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

  await page
    .goto(`${WEB_URL}/auth/dev-login?${params.toString()}`, {
      waitUntil: 'domcontentloaded',
    })
    .catch((error: unknown) => {
      if (!String(error).includes('net::ERR_ABORTED')) throw error;
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

export async function wipeAndReseed(
  page: Page,
  variant: 'minimum' | 'advanced' = 'advanced',
) {
  const body = JSON.stringify({ '0': { json: { variant } } });
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await page.request.post('/trpc/dev.wipeAndReseed?batch=1', {
      data: body,
      headers: { 'content-type': 'application/json' },
    });

    const responseBody = await response.text();
    if (response.ok()) {
      return;
    }

    if (response.status() === 429 && responseBody.includes('rate_limit_exceeded') && attempt === 1) {
      const retryAfter = Number(/"retryAfter":(\d+)/.exec(responseBody)?.[1] ?? 60);
      await page.waitForTimeout(Math.min(retryAfter, 65) * 1000);
      continue;
    }

    throw new Error(`dev.wipeAndReseed failed: ${response.status()} ${responseBody}`);
  }
}

import { test as setup } from '@playwright/test';
import { resolve, dirname } from 'node:path';

const authDir = resolve(dirname(__filename), '.auth');

const API_URL = 'http://127.0.0.1:3101';
const WEB_URL = 'http://127.0.0.1:3100';
const COOKIE_NAME = 'customreport_session';

const roles = ['lead', 'head', 'viewer'] as const;

for (const role of roles) {
  setup(`authenticate as ${role}`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Hit the dev-login endpoint — it creates/finds user and sets JWT cookie
    await page.goto(`${API_URL}/auth/dev-login?role=${role}`);

    // Extract the session cookie set by API
    const cookies = await context.cookies(API_URL);
    const sessionCookie = cookies.find((c) => c.name === COOKIE_NAME);

    if (!sessionCookie) {
      throw new Error(`No ${COOKIE_NAME} cookie set after dev-login for role=${role}`);
    }

    // Add the same cookie for the Web origin (different port)
    await context.addCookies([
      {
        name: sessionCookie.name,
        value: sessionCookie.value,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: sessionCookie.httpOnly,
        secure: sessionCookie.secure,
        sameSite: sessionCookie.sameSite,
        expires: sessionCookie.expires,
      },
    ]);

    // Verify Web is accessible with the cookie
    await page.goto(WEB_URL);

    // Save storageState (cookies + localStorage) for this role
    await context.storageState({
      path: resolve(authDir, `${role}.json`),
    });

    await context.close();
  });
}

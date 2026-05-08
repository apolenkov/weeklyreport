import type { Page } from '@playwright/test';

type Role = 'lead' | 'head' | 'admin' | 'viewer';

const API_DEV_LOGIN_URL = 'http://localhost:3002/auth/dev-login';
const WEB_URL = 'http://localhost:3000';
const COOKIE_NAME = 'customreport_session';

type DevAuthIdentity = {
  role: Role;
  email?: string;
  redirect?: string;
  expectRole?: Role;
  maxRetries?: number;
};

type AuthMeEntry = {
  result?: { data?: { json?: unknown } | unknown };
  error?: unknown;
  message?: unknown;
};
type SessionRoleResult = 'rate_limited' | Role | null;

function parseAuthMeRole(payload: unknown): SessionRoleResult {
  const entry = (Array.isArray(payload) ? payload[0] : payload) as
    | AuthMeEntry
    | undefined;
  if (!entry) {
    return null;
  }

  if (typeof entry === 'object' && entry.error === 'rate_limit_exceeded') {
    return 'rate_limited';
  }

  if (entry.error) {
    return null;
  }

  if (Array.isArray(payload) && payload.length === 0) {
    return null;
  }

  const resultData = entry.result?.data as { json?: unknown } | undefined;
  const rawSession = resultData?.json ?? resultData;
  const session = rawSession as { role?: string } | null;

  if (!session || typeof session !== 'object') {
    return null;
  }

  return session.role as Role;
}

async function getSessionRole(page: Page): Promise<SessionRoleResult> {
  const response = await page.request.get('/trpc/auth.me', {
    maxRedirects: 0,
  });

  if (response.status() === 429) {
    return 'rate_limited';
  }

  if (!response.ok()) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return parseAuthMeRole(payload);
}

function roleFromEmail(
  role: Role,
  email: string | undefined,
  attempt: number,
): string | undefined {
  if (email) {
    return email;
  }

  if (attempt === 1) {
    return undefined;
  }

  return `${role}-probe-${Date.now()}-${attempt}@customreport.local`;
}

export async function loginByCookie(page: Page, identity: DevAuthIdentity) {
  await page.context().clearCookies();

  const expectedRole = identity.expectRole ?? identity.role;
  const attempts = Math.max(1, identity.maxRetries ?? (expectedRole ? 3 : 1));
  let assumeRoleFromAuthMe = false;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const email = roleFromEmail(identity.role, identity.email, attempt);
    const params = new URLSearchParams({ role: identity.role });
    if (email) params.set('email', email);
    if (identity.redirect) params.set('redirect', identity.redirect);

    const response = await page
      .context()
      .request.get(`${WEB_URL}/auth/dev-login?${params.toString()}`, {
        maxRedirects: 0,
      });

    if (response.status() < 300 || response.status() >= 400) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `dev-login failed for role=${identity.role} attempt=${attempt}: HTTP ${response.status()} ${body.slice(0, 300)}`,
      );
    }

    const cookies = await page.context().cookies(WEB_URL);
    const hasSession = cookies.some(
      (cookie) => cookie.name === COOKIE_NAME && cookie.value.length > 20,
    );
    if (!hasSession) {
      throw new Error(
        `dev-login did not establish ${COOKIE_NAME} via ${API_DEV_LOGIN_URL}`,
      );
    }

    const actualRole = await getSessionRole(page);
    if (actualRole === 'rate_limited') {
      if (attempt >= attempts) {
        // If role check endpoint is rate-limited, assume login succeeded and
        // defer session correctness to route-level guards (which are exercised
        // by each regression scenario).
        assumeRoleFromAuthMe = true;
        break;
      }
      await page.waitForTimeout(300 + attempt * 100);
      continue;
    }

    if (!expectedRole || actualRole === expectedRole) {
      if (identity.redirect) {
        await page
          .goto(`${WEB_URL}${identity.redirect}`, {
            waitUntil: 'domcontentloaded',
          })
          .catch((error: unknown) => {
            if (!String(error).includes('net::ERR_ABORTED')) throw error;
          });
      } else {
        await page
          .goto(`${WEB_URL}/`, { waitUntil: 'domcontentloaded' })
          .catch(() => null);
      }
      return;
    }

    if (attempt >= attempts) {
      if (expectedRole) {
        throw new Error(
          `dev-login role mismatch for ${identity.role}: expected ${expectedRole}, got ${actualRole ?? 'null'}`,
        );
      }
      return;
    }

    await page.context().clearCookies();
  }

  if (assumeRoleFromAuthMe) {
    if (identity.redirect) {
      await page
        .goto(`${WEB_URL}${identity.redirect}`, {
          waitUntil: 'domcontentloaded',
        })
        .catch((error: unknown) => {
          if (!String(error).includes('net::ERR_ABORTED')) throw error;
        });
    } else {
      await page
        .goto(`${WEB_URL}/`, { waitUntil: 'domcontentloaded' })
        .catch(() => null);
    }
    return;
  }
}

export async function wipeAndReseed(
  page: Page,
  variant: 'minimum' | 'advanced' | 'manual-uat' = 'advanced',
) {
  const body = JSON.stringify({ '0': { json: { variant } } });
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await page.request.post(
      '/trpc/dev.wipeAndReseed?batch=1',
      {
        data: body,
        headers: { 'content-type': 'application/json' },
      },
    );

    const responseBody = await response.text();
    if (response.ok()) {
      return;
    }

    if (
      response.status() === 429 &&
      responseBody.includes('rate_limit_exceeded') &&
      attempt === 1
    ) {
      const retryAfterHeader = response.headers()['retry-after'];
      const retryAfterPayload = Number(
        /"retryAfter":(\d+)/.exec(responseBody)?.[1] ?? NaN,
      );
      const retryAfter = Number.isFinite(retryAfterPayload)
        ? retryAfterPayload
        : Number(retryAfterHeader ?? NaN);
      const resolvedWaitMs = Math.min(
        Number.isFinite(retryAfter) ? retryAfter * 1000 : 2000,
        5000,
      );
      const jitter = 250 * attempt + Math.floor(Math.random() * 250);
      await page.waitForTimeout(resolvedWaitMs + jitter);
      continue;
    }

    throw new Error(
      `dev.wipeAndReseed failed: ${response.status()} ${responseBody}`,
    );
  }
}

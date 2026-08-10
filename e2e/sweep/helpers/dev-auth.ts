import {
  type DbRole,
  type Role,
  sessionRoleSchema,
} from "@customreport/shared";
import type { Page } from "@playwright/test";

// Use relative URL so the request goes through the Playwright baseURL
// (the configured UAT web origin in E2E mode) instead of hardcoded localhost:3000.
// Cookies set via localhost domain are not sent to 127.0.0.1 and the tRPC
// context DEV_SESSION fallback would return role=head for any unauthenticated
// request, causing false "role mismatch" failures.
const DEV_LOGIN_PATH = "/auth/dev-login";
const COOKIE_NAME = "customreport_session";

const RATE_LIMITED_STATUS = 429;
// dev-login answers with a redirect; anything else is a failure, not a session.
const REDIRECT_STATUS_MIN = 300;
const REDIRECT_STATUS_MAX = 400;
// The role probe shares the login rate limiter, so back off between tries.
const DEFAULT_ATTEMPTS = 3;
const RETRY_BASE_MS = 300;
const RETRY_STEP_MS = 100;
// Long enough to tell a real signed session from an empty or cleared cookie.
const MIN_SESSION_COOKIE_CHARS = 20;
const ERROR_BODY_CHARS = 300;

interface DevAuthIdentity {
  role: DbRole;
  email?: string;
  redirect?: string;
  expectRole?: Role;
  maxRetries?: number;
}

interface AuthMeEntry {
  result?: { data?: unknown };
  error?: unknown;
  message?: unknown;
}
type SessionIdentity = Readonly<{ role: Role; email: string | null }>;
type SessionIdentityResult = "rate_limited" | SessionIdentity | null;

function parseAuthMeIdentity(payload: unknown): SessionIdentity | null {
  const entry = (Array.isArray(payload) ? payload[0] : payload) as
    AuthMeEntry | undefined;
  if (!entry) {
    return null;
  }

  if (entry.error) {
    return null;
  }

  const resultData = entry.result?.data as { json?: unknown } | undefined;
  const rawSession = resultData?.json ?? resultData;
  const session = rawSession as { role?: string; email?: unknown } | null;

  if (!session || typeof session !== "object") {
    return null;
  }

  const parsed = sessionRoleSchema.safeParse(session.role);
  return parsed.success
    ? {
        role: parsed.data,
        email: typeof session.email === "string" ? session.email : null,
      }
    : null;
}

async function getSessionIdentity(page: Page): Promise<SessionIdentityResult> {
  const response = await page.request.get("/trpc/auth.me", {
    maxRedirects: 0,
  });

  if (response.status() === RATE_LIMITED_STATUS) {
    return "rate_limited";
  }

  if (!response.ok()) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return parseAuthMeIdentity(payload);
}

async function navigateAfterLogin(
  page: Page,
  redirect: string | undefined,
): Promise<void> {
  if (redirect) {
    await page
      .goto(redirect, { waitUntil: "domcontentloaded" })
      .catch((error: unknown) => {
        if (!String(error).includes("net::ERR_ABORTED")) throw error;
      });
    return;
  }
  await page.goto("/", { waitUntil: "domcontentloaded" }).catch(() => null);
}

// Ask for the cookie and prove it arrived. Anything short of a redirect
// carrying a plausible session is a failure worth the raw body in the message —
// a silent retry here would hide a broken dev-login behind a role mismatch.
async function establishSession(
  page: Page,
  identity: DevAuthIdentity,
  attempt: number,
): Promise<void> {
  const params = new URLSearchParams({
    role: identity.role,
    ...(identity.email ? { email: identity.email } : {}),
    ...(identity.redirect ? { redirect: identity.redirect } : {}),
  });

  const response = await page
    .context()
    .request.get(`${DEV_LOGIN_PATH}?${params.toString()}`, {
      maxRedirects: 0,
    });

  const status = response.status();
  if (status < REDIRECT_STATUS_MIN || status >= REDIRECT_STATUS_MAX) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `dev-login failed for role=${identity.role} attempt=${attempt}: HTTP ${status} ${body.slice(0, ERROR_BODY_CHARS)}`,
    );
  }

  const cookies = await page.context().cookies();
  const hasSession = cookies.some(
    (cookie) =>
      cookie.name === COOKIE_NAME &&
      cookie.value.length > MIN_SESSION_COOKIE_CHARS,
  );
  if (!hasSession) {
    throw new Error(
      `dev-login did not establish ${COOKIE_NAME} via ${DEV_LOGIN_PATH}`,
    );
  }
}

async function verifySessionIdentity(
  page: Page,
  expectedRole: Role,
  expectedEmail: string | undefined,
  attempts: number,
  attempt: number,
): Promise<SessionIdentity | null> {
  const actual = await getSessionIdentity(page);
  if (actual !== "rate_limited") {
    return actual;
  }

  if (attempt >= attempts) {
    throw new Error(
      `dev-login identity verification remained rate-limited after ${attempts} attempts; expected role=${expectedRole} email=${expectedEmail ?? "any"}`,
    );
  }

  await page.waitForTimeout(RETRY_BASE_MS + attempt * RETRY_STEP_MS);
  return verifySessionIdentity(
    page,
    expectedRole,
    expectedEmail,
    attempts,
    attempt + 1,
  );
}

const sessionMatches = (
  actual: SessionIdentity | null,
  expectedRole: Role,
  expectedEmail: string | undefined,
): boolean =>
  actual?.role === expectedRole &&
  (expectedEmail === undefined || actual.email === expectedEmail);

const observedSession = (actual: SessionIdentity | null): string =>
  actual === null
    ? "role=null email=null"
    : `role=${actual.role} email=${actual.email ?? "null"}`;

async function attemptLogin(
  page: Page,
  identity: DevAuthIdentity,
  expectedRole: Role,
  attempts: number,
  attempt: number,
): Promise<void> {
  await establishSession(page, identity, attempt);

  const actual = await verifySessionIdentity(
    page,
    expectedRole,
    identity.email,
    attempts,
    1,
  );
  const isLast = attempt >= attempts;

  if (sessionMatches(actual, expectedRole, identity.email)) {
    return navigateAfterLogin(page, identity.redirect);
  }

  if (isLast) {
    throw new Error(
      `dev-login identity mismatch for ${identity.role}: expected role=${expectedRole} email=${identity.email ?? "any"}, got ${observedSession(actual)}`,
    );
  }

  await page.context().clearCookies();
  return attemptLogin(page, identity, expectedRole, attempts, attempt + 1);
}

export async function loginByCookie(
  page: Page,
  identity: DevAuthIdentity,
): Promise<void> {
  await page.context().clearCookies();
  const expectedRole = identity.expectRole ?? identity.role;
  const attempts = Math.max(1, identity.maxRetries ?? DEFAULT_ATTEMPTS);
  return attemptLogin(page, identity, expectedRole, attempts, 1);
}

import type { Page } from "@playwright/test";

type Role = "lead" | "head" | "admin" | "viewer";

// Use relative URL so the request goes through the Playwright baseURL
// (http://127.0.0.1:3100 in E2E mode) instead of hardcoded localhost:3000.
// Cookies set via localhost domain are not sent to 127.0.0.1 and the tRPC
// context DEV_SESSION fallback would return role=head for any unauthenticated
// request, causing false "role mismatch" failures.
const DEV_LOGIN_PATH = "/auth/dev-login";
const COOKIE_NAME = "customreport_session";

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
type SessionRoleResult = "rate_limited" | Role | null;

function parseAuthMeRole(payload: unknown): SessionRoleResult {
  const entry = (Array.isArray(payload) ? payload[0] : payload) as
    | AuthMeEntry
    | undefined;
  if (!entry) {
    return null;
  }

  if (entry.error) {
    return null;
  }

  const resultData = entry.result?.data as { json?: unknown } | undefined;
  const rawSession = resultData?.json ?? resultData;
  const session = rawSession as { role?: string } | null;

  if (!session || typeof session !== "object") {
    return null;
  }

  const role = session.role;
  if (
    role === "lead" ||
    role === "head" ||
    role === "admin" ||
    role === "viewer"
  ) {
    return role;
  }
  return null;
}

async function getSessionRole(page: Page): Promise<SessionRoleResult> {
  const response = await page.request.get("/trpc/auth.me", {
    maxRedirects: 0,
  });

  if (response.status() === 429) {
    return "rate_limited";
  }

  if (!response.ok()) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return parseAuthMeRole(payload);
}

function emailFromRole(
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

export async function loginByCookie(page: Page, identity: DevAuthIdentity) {
  await page.context().clearCookies();

  const expectedRole = identity.expectRole ?? identity.role;
  const attempts = Math.max(1, identity.maxRetries ?? (expectedRole ? 3 : 1));
  let assumeRoleFromAuthMe = false;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const email = emailFromRole(identity.role, identity.email, attempt);
    const params = new URLSearchParams({ role: identity.role });
    if (email) params.set("email", email);
    if (identity.redirect) params.set("redirect", identity.redirect);

    const response = await page
      .context()
      .request.get(`${DEV_LOGIN_PATH}?${params.toString()}`, {
        maxRedirects: 0,
      });

    if (response.status() < 300 || response.status() >= 400) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `dev-login failed for role=${identity.role} attempt=${attempt}: HTTP ${response.status()} ${body.slice(0, 300)}`,
      );
    }

    const cookies = await page.context().cookies();
    const hasSession = cookies.some(
      (cookie) => cookie.name === COOKIE_NAME && cookie.value.length > 20,
    );
    if (!hasSession) {
      throw new Error(
        `dev-login did not establish ${COOKIE_NAME} via ${DEV_LOGIN_PATH}`,
      );
    }

    const actualRole = await getSessionRole(page);
    if (actualRole === "rate_limited") {
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
      await navigateAfterLogin(page, identity.redirect);
      return;
    }

    if (attempt >= attempts) {
      if (expectedRole) {
        throw new Error(
          `dev-login role mismatch for ${identity.role}: expected ${expectedRole}, got ${actualRole ?? "null"}`,
        );
      }
      return;
    }

    await page.context().clearCookies();
  }

  if (assumeRoleFromAuthMe) {
    await navigateAfterLogin(page, identity.redirect);
    return;
  }
}

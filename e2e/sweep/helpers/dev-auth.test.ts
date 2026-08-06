import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import { loginByCookie } from "./dev-auth.ts";

// A live sweep only ever reaches the first attempt succeeding, which is the one
// case that is not a retry. The branches that make it one need a page whose
// answers can be scripted, so they are driven here instead of against the app.

const SESSION_COOKIE = "customreport_session";
const LONG_ENOUGH = "s".repeat(40);

type AuthMeAnswer = string | Readonly<{ role: string; email: string | null }>;

function isAuthMeSequence(
  value: AuthMeAnswer | readonly AuthMeAnswer[],
): value is readonly AuthMeAnswer[] {
  return Array.isArray(value);
}

interface Attempt {
  // Status the dev-login endpoint answers with. 302 unless a case is about it.
  readonly loginStatus?: number;
  // Session cookie value the context holds afterwards; absent means none set.
  readonly cookie?: string;
  // What the role probe reports back.
  readonly authMe: AuthMeAnswer | readonly AuthMeAnswer[];
}

interface Recorded {
  readonly loginUrls: string[];
  readonly clearCookieCalls: number[];
  readonly waits: number[];
  readonly navigations: string[];
}

const authMeResponse = (answer: AuthMeAnswer) => {
  if (answer === "rate_limited") return { status: 429, body: null };
  if (answer === "unreadable") return { status: 500, body: null };
  const identity =
    typeof answer === "string"
      ? { role: answer, email: `${answer}@example.test` }
      : answer;
  return {
    status: 200,
    body: [{ result: { data: { json: identity } } }],
  };
};

// A Page that answers a scripted sequence: one entry per login attempt, in
// order. Everything the helper touches is recorded so a test can assert on the
// shape of the retry, not only on its outcome.
function scriptedPage(attempts: readonly Attempt[]): {
  page: Page;
  recorded: Recorded;
} {
  const loginUrls: string[] = [];
  const clearCookieCalls: number[] = [];
  const waits: number[] = [];
  const navigations: string[] = [];

  const state = {
    attempt: -1,
    authProbe: 0,
    cookie: undefined as string | undefined,
  };
  const current = (): Attempt => {
    const entry = attempts[Math.min(state.attempt, attempts.length - 1)];
    if (!entry) throw new Error("scripted page ran past its script");
    return entry;
  };

  const context = {
    clearCookies: () => {
      clearCookieCalls.push(state.attempt);
      state.cookie = undefined;
      return Promise.resolve();
    },
    cookies: () =>
      Promise.resolve(
        state.cookie === undefined
          ? []
          : [{ name: SESSION_COOKIE, value: state.cookie }],
      ),
    request: {
      get: (url: string) => {
        state.attempt += 1;
        loginUrls.push(url);
        const entry = current();
        state.cookie = entry.cookie;
        const status = entry.loginStatus ?? 302;
        return Promise.resolve({
          status: () => status,
          text: () => Promise.resolve("body from dev-login"),
        });
      },
    },
  };

  const page = {
    context: () => context,
    request: {
      get: () => {
        const scriptedAnswer = current().authMe;
        const answer = isAuthMeSequence(scriptedAnswer)
          ? scriptedAnswer[Math.min(state.authProbe, scriptedAnswer.length - 1)]
          : scriptedAnswer;
        if (!answer) throw new Error("scripted auth.me answer is missing");
        state.authProbe += 1;
        const { status, body } = authMeResponse(answer);
        return Promise.resolve({
          status: () => status,
          ok: () => status === 200,
          json: () => Promise.resolve(body),
        });
      },
    },
    waitForTimeout: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
    goto: (url: string) => {
      navigations.push(url);
      return Promise.resolve(null);
    },
  };

  return {
    page: page as unknown as Page,
    recorded: { loginUrls, clearCookieCalls, waits, navigations },
  };
}

const ok = (authMe: string): Attempt => ({ cookie: LONG_ENOUGH, authMe });

describe("loginByCookie", () => {
  it("navigates and stops once the role matches on the first attempt", async () => {
    const { page, recorded } = scriptedPage([ok("lead")]);

    await loginByCookie(page, { role: "lead" });

    expect(recorded.loginUrls).toHaveLength(1);
    expect(recorded.navigations).toEqual(["/"]);
    expect(recorded.waits).toEqual([]);
  });

  it("follows the caller's redirect instead of the root", async () => {
    const { page, recorded } = scriptedPage([ok("admin")]);

    await loginByCookie(page, { role: "admin", redirect: "/admin" });

    expect(recorded.loginUrls[0]).toContain("redirect=%2Fadmin");
    expect(recorded.navigations).toEqual(["/admin"]);
  });

  it("re-logs in after a role mismatch, clearing cookies between attempts", async () => {
    const { page, recorded } = scriptedPage([ok("head"), ok("lead")]);

    await loginByCookie(page, { role: "lead" });

    expect(recorded.loginUrls).toHaveLength(2);
    expect(recorded.navigations).toEqual(["/"]);
    // Once before the first attempt, once because the mismatch retried.
    expect(recorded.clearCookieCalls).toHaveLength(2);
    // A mismatch is not a rate limit, so it does not back off.
    expect(recorded.waits).toEqual([]);
  });

  it("backs off and retries while the identity probe is rate-limited", async () => {
    const { page, recorded } = scriptedPage([
      {
        cookie: LONG_ENOUGH,
        authMe: ["rate_limited", "viewer"],
      },
    ]);

    await loginByCookie(page, { role: "viewer" });

    expect(recorded.loginUrls).toHaveLength(1);
    // 300ms base plus 100ms per attempt already spent.
    expect(recorded.waits).toEqual([400]);
    // Deliberately NOT cleared here: the cookie is good, only the probe failed.
    expect(recorded.clearCookieCalls).toHaveLength(1);
    expect(recorded.navigations).toEqual(["/"]);
  });

  it("fails closed when the identity probe is still rate-limited on the last attempt", async () => {
    const { page, recorded } = scriptedPage([
      { cookie: LONG_ENOUGH, authMe: "rate_limited" },
    ]);

    await expect(
      loginByCookie(page, { role: "head", maxRetries: 1 }),
    ).rejects.toThrow(
      /identity verification remained rate-limited.*expected role=head/,
    );

    expect(recorded.loginUrls).toHaveLength(1);
    expect(recorded.navigations).toEqual([]);
  });

  it("throws naming both roles when the mismatch survives every attempt", async () => {
    const { page, recorded } = scriptedPage([ok("viewer")]);

    await expect(
      loginByCookie(page, { role: "lead", maxRetries: 1 }),
    ).rejects.toThrow(/expected role=lead.*got role=viewer/);
    expect(recorded.navigations).toEqual([]);
  });

  it("reports a null role rather than the string 'null'", async () => {
    const { page } = scriptedPage([
      { cookie: LONG_ENOUGH, authMe: "unreadable" },
    ]);

    await expect(
      loginByCookie(page, { role: "lead", maxRetries: 1 }),
    ).rejects.toThrow(/got role=null email=null/);
  });

  it("gives up immediately when dev-login does not redirect", async () => {
    const { page, recorded } = scriptedPage([
      { loginStatus: 500, cookie: LONG_ENOUGH, authMe: "lead" },
    ]);

    await expect(loginByCookie(page, { role: "lead" })).rejects.toThrow(
      /HTTP 500 body from dev-login/,
    );
    // A broken endpoint is not retried: it would only fail the same way again.
    expect(recorded.loginUrls).toHaveLength(1);
  });

  it("gives up when the redirect arrives without a usable session cookie", async () => {
    const { page } = scriptedPage([{ cookie: "short", authMe: "lead" }]);

    await expect(loginByCookie(page, { role: "lead" })).rejects.toThrow(
      new RegExp(`did not establish ${SESSION_COOKIE}`),
    );
  });

  it("honours expectRole over the role it logs in as", async () => {
    const { page, recorded } = scriptedPage([ok("head")]);

    await loginByCookie(page, { role: "lead", expectRole: "head" });

    expect(recorded.loginUrls[0]).toContain("role=lead");
    expect(recorded.navigations).toEqual(["/"]);
  });

  it("verifies an explicitly selected same-role identity by email", async () => {
    const { page, recorded } = scriptedPage([
      {
        cookie: LONG_ENOUGH,
        authMe: { role: "lead", email: "maria@customreport.local" },
      },
      {
        cookie: LONG_ENOUGH,
        authMe: { role: "lead", email: "lead1@customreport.local" },
      },
    ]);

    await loginByCookie(page, {
      role: "lead",
      email: "lead1@customreport.local",
    });

    expect(recorded.loginUrls).toHaveLength(2);
    expect(recorded.clearCookieCalls).toHaveLength(2);
    expect(recorded.navigations).toEqual(["/"]);
  });
});

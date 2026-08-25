import type { Cookie } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { RuntimeMatrixActor } from "../../matrix/runtime-matrix.ts";
import {
  createPreflightSessionCache,
  type PreflightCookieContext,
} from "./preflight-session.ts";

const lead: RuntimeMatrixActor = {
  id: "lead-id",
  role: "lead",
  email: "lead1@customreport.local",
};
const head: RuntimeMatrixActor = {
  id: "head-id",
  role: "head",
  email: "head@customreport.local",
};

const cookieFor = (role: string, expires: number): Cookie => ({
  name: "customreport_session",
  value: `session-${role}`,
  domain: "127.0.0.1",
  path: "/",
  expires,
  httpOnly: true,
  secure: false,
  sameSite: "Lax",
});

const sessionHarnessFor = (
  cookiesForLogin: (
    actor: RuntimeMatrixActor,
    loginCount: number,
  ) => readonly Cookie[],
  options: Readonly<{ readonly maxRevealDepth?: number }> = {},
) => {
  let nowSeconds = 0;
  let loginCount = 0;
  let activeCookies: readonly Cookie[] = [];
  const context: PreflightCookieContext = {
    clearCookies: vi.fn(() => {
      activeCookies = [];
      return Promise.resolve();
    }),
    cookies: vi.fn(() => Promise.resolve(activeCookies)),
    addCookies: vi.fn((cookies: readonly Cookie[]) => {
      activeCookies = [...cookies];
      return Promise.resolve();
    }),
  };
  const login = vi.fn((actor: RuntimeMatrixActor) => {
    loginCount += 1;
    activeCookies = cookiesForLogin(actor, loginCount);
    return Promise.resolve();
  });
  const cache = createPreflightSessionCache(context, login, {
    nowSeconds: () => nowSeconds,
    ...options,
  });
  return {
    cache,
    context,
    login,
    activeCookies: () => activeCookies,
    setNowSeconds: (value: number) => {
      nowSeconds = value;
    },
  };
};

describe("preflight session expiry", () => {
  it.each([0, 1.5, Number.MAX_SAFE_INTEGER])(
    "rejects an invalid reveal depth %s before authentication",
    (maxRevealDepth) => {
      expect(() => sessionHarnessFor(() => [], { maxRevealDepth })).toThrow(
        /reveal depth must be a positive safe integer/iu,
      );
    },
  );

  it("refreshes only the selected actor at the expiry safety boundary", async () => {
    const harness = sessionHarnessFor((actor, loginCount) => [
      cookieFor(
        `${actor.role ?? "anonymous"}-${loginCount}`,
        loginCount === 1 ? 1000 : 4600,
      ),
    ]);

    await harness.cache.authenticate([lead, head]);
    harness.setNowSeconds(699);
    await harness.cache.use(lead);
    expect(harness.activeCookies()[0]?.value).toBe("session-lead-1");
    expect(harness.login).toHaveBeenCalledTimes(2);

    harness.setNowSeconds(700);
    await harness.cache.use(lead);
    expect(harness.activeCookies()[0]?.value).toBe("session-lead-3");
    await harness.cache.use(head);
    expect(harness.activeCookies()[0]?.value).toBe("session-head-2");
    expect(harness.login).toHaveBeenCalledTimes(3);
  });

  it("derives the refresh boundary from a custom reveal depth", async () => {
    const harness = sessionHarnessFor(
      (actor, loginCount) => [
        cookieFor(
          `${actor.role ?? "anonymous"}-${loginCount}`,
          loginCount <= 2 ? 1000 : 4600,
        ),
      ],
      { maxRevealDepth: 8 },
    );

    await harness.cache.authenticate([lead, head]);
    harness.setNowSeconds(459);
    await harness.cache.use(lead);
    expect(harness.activeCookies()[0]?.value).toBe("session-lead-1");
    expect(harness.login).toHaveBeenCalledTimes(2);

    harness.setNowSeconds(460);
    await harness.cache.use(lead);
    expect(harness.activeCookies()[0]?.value).toBe("session-lead-3");
    harness.setNowSeconds(0);
    await harness.cache.use(head);
    expect(harness.activeCookies()[0]?.value).toBe("session-head-2");
    expect(harness.login).toHaveBeenCalledTimes(3);
  });

  it("fails closed when an expiring session cannot be refreshed", async () => {
    const harness = sessionHarnessFor((actor, loginCount) =>
      loginCount === 1 ? [cookieFor(actor.role ?? "anonymous", 1000)] : [],
    );

    await harness.cache.authenticate([lead]);
    harness.setNowSeconds(700);

    await expect(harness.cache.use(lead)).rejects.toThrow(
      /did not produce a session cookie/iu,
    );
    expect(harness.context.addCookies).not.toHaveBeenCalled();
  });

  it("rejects an authenticated cookie without an absolute expiry", async () => {
    const harness = sessionHarnessFor((actor) => [
      cookieFor(actor.role ?? "anonymous", -1),
    ]);

    await expect(harness.cache.authenticate([lead])).rejects.toThrow(
      /did not produce an expiring session cookie/iu,
    );
  });

  it.each([999, 1000, 699])(
    "rejects a refreshed session whose expiry %s is not beyond the safety window",
    async (refreshedExpiry) => {
      const harness = sessionHarnessFor((actor, loginCount) => [
        cookieFor(
          actor.role ?? "anonymous",
          loginCount === 1 ? 1000 : refreshedExpiry,
        ),
      ]);

      await harness.cache.authenticate([lead]);
      harness.setNowSeconds(700);

      await expect(harness.cache.use(lead)).rejects.toThrow(
        /remains inside the replay safety window/iu,
      );
      harness.setNowSeconds(0);
      await expect(harness.cache.use(lead)).rejects.toThrow(
        /no cached session exists/iu,
      );
      expect(harness.activeCookies()).toEqual([]);
      expect(harness.context.addCookies).not.toHaveBeenCalled();
    },
  );

  it.each([
    [1000, "rejects"],
    [1001, "accepts"],
  ] as const)(
    "%s-second custom-depth replacement %s the exact replay boundary",
    async (refreshedExpiry, expected) => {
      const harness = sessionHarnessFor(
        (actor, loginCount) => [
          cookieFor(
            actor.role ?? "anonymous",
            loginCount === 1 ? 1000 : refreshedExpiry,
          ),
        ],
        { maxRevealDepth: 8 },
      );

      await harness.cache.authenticate([lead]);
      harness.setNowSeconds(460);

      if (expected === "rejects") {
        await expect(harness.cache.use(lead)).rejects.toThrow(
          /remains inside the replay safety window/iu,
        );
        expect(harness.activeCookies()).toEqual([]);
        return;
      }
      await expect(harness.cache.use(lead)).resolves.toBeUndefined();
      expect(harness.activeCookies()[0]?.value).toBe("session-lead");
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid session clock value %s",
    async (nowSeconds) => {
      const harness = sessionHarnessFor((actor) => [
        cookieFor(actor.role ?? "anonymous", 1000),
      ]);

      await harness.cache.authenticate([lead]);
      harness.setNowSeconds(nowSeconds);

      await expect(harness.cache.use(lead)).rejects.toThrow(
        /clock must return non-negative epoch seconds/iu,
      );
      harness.setNowSeconds(0);
      await expect(harness.cache.use(lead)).rejects.toThrow(
        /no cached session exists/iu,
      );
      expect(harness.context.addCookies).not.toHaveBeenCalled();
    },
  );
});

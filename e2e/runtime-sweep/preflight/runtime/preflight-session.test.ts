import type { Cookie, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { RuntimeMatrixActor } from "../../matrix/runtime-matrix.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { resetProfileSessions } from "./preflight-runtime-preparation.ts";
import {
  createPreflightSessionCache,
  createProfileSessionCacheRegistry,
  type PreflightCookieContext,
  preflightGroupNeedsReset,
  type PreflightSessionCache,
  quiescePreflightStatePage,
} from "./preflight-session.ts";

const preparationMocks = vi.hoisted(() => ({ reseed: vi.fn() }));

vi.mock("../../../helpers/e2e-database-setup.ts", () => ({
  e2eSetupCommands: vi.fn(() => []),
  reseedE2eDatabase: preparationMocks.reseed,
}));

const cookieFor = (role: string): Cookie => ({
  name: "customreport_session",
  value: `session-${role}`,
  domain: "127.0.0.1",
  path: "/",
  expires: 4_000_000_000,
  httpOnly: true,
  secure: false,
  sameSite: "Lax",
});

const preferenceCookie: Cookie = {
  ...cookieFor("preference"),
  name: "theme",
};

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
const anonymous: RuntimeMatrixActor = { id: null, role: null, email: null };

describe("preflight session cache", () => {
  it("quiesces after reseed authentication", async () => {
    const events: string[] = [];
    preparationMocks.reseed.mockImplementation(() => events.push("reseed"));
    const page = {
      url: () => "http://127.0.0.1:3000/reports",
      goto: vi.fn(() => {
        events.push("quiesce");
        return Promise.resolve();
      }),
    } as unknown as Page;
    const sessions = {
      created: true,
      cache: {
        authenticate: vi.fn(() => {
          events.push("authenticate");
          return Promise.resolve();
        }),
        reauthenticate: vi.fn(() => Promise.resolve()),
        use: vi.fn(() => Promise.resolve()),
      },
    } as unknown as Parameters<typeof resetProfileSessions>[0]["sessions"];

    await resetProfileSessions({
      setup: {
        source: {} as unknown as SourceArtifact,
        page,
        databaseUrl: "postgresql://localhost/customreport_e2e",
        repoRoot: "/workspace/customreport",
        apiUrl: "http://127.0.0.1:3002",
      },
      profile: "full",
      actors: [lead],
      sessions,
      clearPage: () => {
        events.push("clear-storage");
        return Promise.resolve();
      },
      awaitApiDrain: () => {
        events.push("api-drain");
        return Promise.resolve();
      },
    });

    expect(events).toEqual([
      "reseed",
      "authenticate",
      "clear-storage",
      "quiesce",
      "api-drain",
    ]);
  });

  it("clears origin storage before quiescing the previous state page", async () => {
    const events: string[] = [];

    await quiescePreflightStatePage(
      {
        url: () => "http://127.0.0.1:3000/reports",
        goto: vi.fn(() => {
          events.push("quiesce");
          return Promise.resolve();
        }),
      },
      vi.fn(() => {
        events.push("clear-storage");
        return Promise.resolve();
      }),
      vi.fn(() => {
        events.push("api-drain");
        return Promise.resolve();
      }),
    );

    expect(events).toEqual(["clear-storage", "quiesce", "api-drain"]);
  });

  it("does not access client storage from the initial blank page", async () => {
    const clearStorage = vi.fn(() => Promise.resolve());

    await quiescePreflightStatePage(
      {
        url: () => "about:blank",
        goto: vi.fn(() => Promise.resolve()),
      },
      clearStorage,
      vi.fn(() => Promise.resolve()),
    );

    expect(clearStorage).not.toHaveBeenCalled();
  });

  it("reuses authenticated cookies when the actor changes after preparation begins", async () => {
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
      if (actor.role !== null)
        activeCookies = [cookieFor(actor.role), preferenceCookie];
      return Promise.resolve();
    });
    const cache = createPreflightSessionCache(context, login);

    await cache.authenticate([lead, head, lead, anonymous]);
    const loginCallsAfterAuthentication = login.mock.calls.length;

    await cache.use(lead);
    expect(activeCookies[0]?.value).toBe("session-lead");
    expect(activeCookies).toHaveLength(1);
    await cache.use(head);
    expect(activeCookies[0]?.value).toBe("session-head");
    await cache.use(anonymous);
    expect(activeCookies).toHaveLength(0);

    expect(login).toHaveBeenCalledTimes(2);
    expect(login).toHaveBeenCalledTimes(loginCallsAfterAuthentication);
    expect(context.addCookies).toHaveBeenCalledTimes(2);
  });

  it("does not reuse a provisioned actor cookie after a profile reset", async () => {
    let activeCookies: readonly Cookie[] = [];
    let loginCount = 0;
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
      if (actor.role !== null) {
        activeCookies = [cookieFor(`${actor.role}-${loginCount}`)];
      }
      return Promise.resolve();
    });
    const cache = createPreflightSessionCache(context, login);

    await cache.authenticate([lead]);
    await cache.reauthenticate([lead]);
    await cache.use(lead);

    expect(activeCookies[0]?.value).toBe("session-lead-2");
    expect(login).toHaveBeenCalledTimes(2);
  });

  it.each(["authenticate", "reauthenticate"] as const)(
    "quiesces after %s before state preparation",
    async (authenticationMode) => {
      const events: string[] = [];
      const context: PreflightCookieContext = {
        clearCookies: vi.fn(() => Promise.resolve()),
        cookies: vi.fn(() => Promise.resolve([cookieFor("lead")])),
        addCookies: vi.fn(() => Promise.resolve()),
      };
      const cache = createPreflightSessionCache(context, () => {
        return Promise.resolve();
      });
      const page = {
        url: vi
          .fn()
          .mockReturnValueOnce("about:blank")
          .mockReturnValueOnce("http://127.0.0.1:3000/reports"),
        goto: vi.fn(() => {
          events.push("quiesce");
          return Promise.resolve();
        }),
      };
      const clearClientStorage = vi.fn(() => {
        events.push("clear-storage");
        return Promise.resolve();
      });
      const awaitApiDrain = vi.fn(() => {
        events.push("api-drain");
        return Promise.resolve();
      });

      if (authenticationMode === "reauthenticate") {
        await cache.authenticate([lead]);
      }

      await quiescePreflightStatePage(page, clearClientStorage, awaitApiDrain);
      events.push("reset");
      if (authenticationMode === "authenticate") {
        await cache.authenticate([lead]);
      } else {
        await cache.reauthenticate([lead]);
      }
      events.push(authenticationMode);
      await quiescePreflightStatePage(page, clearClientStorage, awaitApiDrain);
      events.push("state-prepared");
      await cache.use(lead);
      events.push("navigation");

      expect(events).toEqual([
        "quiesce",
        "api-drain",
        "reset",
        authenticationMode,
        "clear-storage",
        "quiesce",
        "api-drain",
        "state-prepared",
        "navigation",
      ]);
      expect(clearClientStorage).toHaveBeenCalledTimes(1);
      expect(page.goto).toHaveBeenCalledTimes(2);
    },
  );

  it("fails closed when a non-anonymous actor has no cached session", async () => {
    const context: PreflightCookieContext = {
      clearCookies: vi.fn(() => Promise.resolve()),
      cookies: vi.fn(() => Promise.resolve([])),
      addCookies: vi.fn(() => Promise.resolve()),
    };
    const cache = createPreflightSessionCache(context, () => Promise.resolve());

    await expect(cache.authenticate([lead])).rejects.toThrow(
      "did not produce a session cookie",
    );
  });

  it("creates one distinct cache per seeded profile", async () => {
    const cacheFor = (): PreflightSessionCache => ({
      authenticate: vi.fn(() => Promise.resolve()),
      reauthenticate: vi.fn(() => Promise.resolve()),
      use: vi.fn(() => Promise.resolve()),
    });
    const create = vi.fn((_profile: string) => Promise.resolve(cacheFor()));
    const registry = createProfileSessionCacheRegistry(create);

    const firstMinimal = await registry.get("minimal");
    const secondMinimal = await registry.get("minimal");
    const demo = await registry.get("demo");

    expect(firstMinimal.created).toBe(true);
    expect(secondMinimal.created).toBe(false);
    expect(demo.created).toBe(true);
    expect(firstMinimal.cache).toBe(secondMinimal.cache);
    expect(demo.cache).not.toBe(firstMinimal.cache);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("forces a clean seed after authenticating a new profile session set", () => {
    expect(preflightGroupNeedsReset(undefined, "minimal:active", true)).toBe(
      true,
    );
    expect(
      preflightGroupNeedsReset("minimal:active", "minimal:active", true),
    ).toBe(true);
    expect(
      preflightGroupNeedsReset("minimal:active", "minimal:active", false),
    ).toBe(false);
    expect(
      preflightGroupNeedsReset("minimal:active", "minimal:published", false),
    ).toBe(true);
  });
});

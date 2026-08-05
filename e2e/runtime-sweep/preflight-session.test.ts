import type { Cookie } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import {
  createPreflightSessionCache,
  createProfileSessionCacheRegistry,
  type PreflightCookieContext,
  type PreflightSessionCache,
} from "./preflight-session.ts";
import type { RuntimeMatrixActor } from "./runtime-matrix.ts";

const cookieFor = (role: string): Cookie => ({
  name: "customreport_session",
  value: `session-${role}`,
  domain: "127.0.0.1",
  path: "/",
  expires: -1,
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
});

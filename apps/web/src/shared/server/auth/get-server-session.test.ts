import { AUTH_COOKIE_NAME } from "@customreport/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws if imported from a non-server module — under vitest
// we don't have a Next.js server context, so neutralise it.
vi.mock("server-only", () => ({}));

// `next/headers` is server-only; vi.mock keeps the module surface available
// in jsdom-less test environments without dragging the Next.js runtime.
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

import { expectDefined } from "../../../test-utils/expect-defined.js";
import { decodeAuthMeResponse } from "./decode-auth-me";
import { getServerSession } from "./get-server-session";

const SESSION = {
  userId: "a0000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Head User",
  role: "head" as const,
  activeReportId: null,
  activeReportSectionId: null,
};

describe("decodeAuthMeResponse", () => {
  it("extracts the superjson-wrapped payload", () => {
    const body = [{ result: { data: { json: SESSION } } }];
    expect(decodeAuthMeResponse(body)).toEqual(SESSION);
  });

  it("accepts a schema-valid session in the untransformed shape (config-drift fallback)", () => {
    const body = [{ result: { data: SESSION } }];
    expect(decodeAuthMeResponse(body)).toEqual(SESSION);
  });

  it("returns null for an explicit null payload (auth.me unauthenticated)", () => {
    expect(
      decodeAuthMeResponse([{ result: { data: { json: null } } }]),
    ).toBeNull();
    expect(decodeAuthMeResponse([{ result: { data: null } }])).toBeNull();
  });

  it("returns null for an error envelope", () => {
    expect(
      decodeAuthMeResponse([{ error: { message: "UNAUTHORIZED" } }]),
    ).toBeNull();
  });

  it("returns null for a malformed body", () => {
    expect(decodeAuthMeResponse(undefined)).toBeNull();
    expect(decodeAuthMeResponse({})).toBeNull();
    expect(decodeAuthMeResponse([])).toBeNull();
  });

  it("returns null for a malformed session payload", () => {
    const body = [
      {
        result: {
          data: {
            json: {
              ...SESSION,
              role: "super-admin",
            },
          },
        },
      },
    ];
    expect(decodeAuthMeResponse(body)).toBeNull();
  });
});

describe("getServerSession", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    cookieStore.get.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // The unit suite loads no env file; requireApiUrl has no fallback.
    vi.stubEnv("API_URL", "http://localhost:3002");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns null when the session cookie is absent", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");
    cookieStore.get.mockReturnValue(undefined);
    const result = await getServerSession();
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the auth.me dev fallback when dev mode is enabled and no cookie exists", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "true");
    cookieStore.get.mockReturnValue(undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: { data: { json: SESSION } } }]),
    });

    const result = await getServerSession();
    expect(result).toEqual(SESSION);

    const [url, init] = expectDefined(
      fetchMock.mock.calls[0] as [string, RequestInit],
    );
    expect(url).toContain("/trpc/auth.me");
    expect(init.headers).toBeUndefined();
    expect(init.cache).toBe("no-store");
  });

  it("returns the decoded session when auth.me resolves", async () => {
    cookieStore.get.mockReturnValue({ value: "a-jwt-cookie-value" });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: { data: { json: SESSION } } }]),
    });

    const result = await getServerSession();
    expect(result).toEqual(SESSION);

    const [url, init] = expectDefined(
      fetchMock.mock.calls[0] as [string, RequestInit],
    );
    expect(url).toContain("/trpc/auth.me");
    expect(init.headers).toMatchObject({
      cookie: `${AUTH_COOKIE_NAME}=a-jwt-cookie-value`,
    });
    // cache: 'no-store' is mandatory so role downgrades are visible at
    // request time rather than waiting on the data cache.
    expect(init.cache).toBe("no-store");
  });

  it("returns null when auth.me throws UNAUTHORIZED (failure-closed)", async () => {
    cookieStore.get.mockReturnValue({ value: "stale" });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve([{ error: { message: "UNAUTHORIZED" } }]),
    });
    const result = await getServerSession();
    expect(result).toBeNull();
  });

  it("returns null on a network error (failure-closed)", async () => {
    cookieStore.get.mockReturnValue({ value: "a-token" });
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await getServerSession();
    expect(result).toBeNull();
  });
});

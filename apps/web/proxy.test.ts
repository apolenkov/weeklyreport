import { AUTH_COOKIE_NAME } from "@customreport/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import proxy, { config } from "./src/proxy";

// ---------------------------------------------------------------------------
// Helpers — build a request-shaped stub that satisfies the subset of
// NextRequest the proxy actually touches.
// ---------------------------------------------------------------------------

type CookieJar = Record<string, string>;

function makeRequest(
  pathname: string,
  search = "",
  cookies: CookieJar = {},
): import("next/server").NextRequest {
  const url = `http://localhost:3000${pathname}${search}`;
  const cookieApi = {
    has: (name: string) => Object.hasOwn(cookies, name),
    get: (name: string) =>
      Object.hasOwn(cookies, name) ? { name, value: cookies[name] } : undefined,
  };
  const nextUrl = {
    pathname,
    search,
    href: url,
  };
  // Cast through unknown — proxy only uses .cookies.has, .nextUrl, and .url.
  return {
    url,
    nextUrl,
    cookies: cookieApi,
  } as unknown as import("next/server").NextRequest;
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

const ORIGINAL_AUTH_STUB = process.env.NEXT_PUBLIC_AUTH_STUB;

beforeEach(() => {
  // Default to non-stub mode for these tests; individual tests opt into stub.
  process.env.NEXT_PUBLIC_AUTH_STUB = "false";
});

afterEach(() => {
  if (ORIGINAL_AUTH_STUB === undefined) {
    delete process.env.NEXT_PUBLIC_AUTH_STUB;
  } else {
    process.env.NEXT_PUBLIC_AUTH_STUB = ORIGINAL_AUTH_STUB;
  }
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("apps/web/proxy.ts — auth guard", () => {
  it("redirects to /?next=<path> when no session cookie and AUTH_STUB!=true", () => {
    const req = makeRequest("/lead/report");
    const response = proxy(req);

    // NextResponse.redirect returns a Response with status 307 and a Location header.
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/?next=");
    // %2F is the URL-encoded form of /
    expect(location).toMatch(/next=%2Flead%2Freport/);
  });

  it("preserves query string in next= param", () => {
    const req = makeRequest("/lead/report", "?period=2026-W17");
    const response = proxy(req);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    // searchParams.set encodes the entire string value, so '?' becomes '%3F'.
    expect(location).toMatch(/next=%2Flead%2Freport%3Fperiod%3D2026-W17/);
  });

  it("passes through when a JWT-shaped session cookie is present", () => {
    // Three dot-separated base64-ish segments, total length > 20.
    const validShapeJwt = "aaaaaaaaaa.bbbbbbbbbb.cccccccccc";
    const req = makeRequest("/lead/report", "", {
      [AUTH_COOKIE_NAME]: validShapeJwt,
    });
    const response = proxy(req);

    // NextResponse.next() returns 200 with no Location.
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects when session cookie value is empty string", () => {
    const req = makeRequest("/lead/report", "", {
      [AUTH_COOKIE_NAME]: "",
    });
    const response = proxy(req);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/?next=");
  });

  it.each([
    {
      label: "non-JWT-shaped (no dots)",
      cookie: "invalid",
    },
    {
      // Two-segment value (only one dot) — must be rejected.
      label: "wrong segment count (one dot / two parts)",
      cookie: "header.payloadbutnosignature",
    },
    {
      // 3 segments separated by dots, but length 14 (≤ 20).
      label: "JWT-shaped but too short (≤20 chars)",
      cookie: "jwt.token.here",
    },
  ] as const)("redirects when session cookie is $label", ({ cookie }) => {
    const req = makeRequest("/lead/report", "", {
      [AUTH_COOKIE_NAME]: cookie,
    });
    const response = proxy(req);

    expect(response.status).toBe(307);
    expect(response.headers.get("location") ?? "").toContain("/?next=");
  });

  it("redirects no-cookie protected pages even when NEXT_PUBLIC_AUTH_STUB=true", () => {
    process.env.NEXT_PUBLIC_AUTH_STUB = "true";

    const req = makeRequest("/lead/report"); // no cookie
    const response = proxy(req);

    expect(response.status).toBe(307);
    expect(response.headers.get("location") ?? "").toMatch(
      /next=%2Flead%2Freport/,
    );
  });
});

describe("apps/web/proxy.ts — config matcher", () => {
  it("exports a config object with every protected route matcher", () => {
    expect(config).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher).toHaveLength(5);
  });

  it("matcher is a positive allowlist of protected prefixes", () => {
    const matcher = config.matcher;
    // Each entry is one of the protected prefixes with a :path*
    // suffix. Order is not significant; assert membership.
    expect(matcher).toEqual(
      expect.arrayContaining([
        "/lead/:path*",
        "/head/:path*",
        "/reports/:path*",
        "/admin/:path*",
        "/feedback/:path*",
      ]),
    );
    // Every entry begins with one of the protected prefixes.
    for (const entry of matcher) {
      expect(entry).toMatch(/^\/(lead|head|reports|admin|feedback)\//);
    }
  });

  it("matcher does not include excluded routes (_next, api, trpc, auth, favicon)", () => {
    const matcher = config.matcher;
    // The allowlist must not mention any route that is intentionally
    // unprotected by the proxy (those handle their own auth or are static).
    for (const entry of matcher) {
      expect(entry).not.toMatch(/_next/);
      expect(entry).not.toMatch(/(^|\/)api(\/|$)/);
      expect(entry).not.toMatch(/trpc/);
      expect(entry).not.toMatch(/(^|\/)auth(\/|$)/);
      expect(entry).not.toMatch(/favicon/);
    }
  });
});

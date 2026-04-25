import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import proxy, { config } from './proxy';

// ---------------------------------------------------------------------------
// Helpers — build a request-shaped stub that satisfies the subset of
// NextRequest the proxy actually touches.
// ---------------------------------------------------------------------------

type CookieJar = Record<string, string>;

function makeRequest(
  pathname: string,
  search = '',
  cookies: CookieJar = {},
): import('next/server').NextRequest {
  const url = `http://localhost:3000${pathname}${search}`;
  const cookieApi = {
    has: (name: string) => Object.prototype.hasOwnProperty.call(cookies, name),
    get: (name: string) =>
      Object.prototype.hasOwnProperty.call(cookies, name)
        ? { name, value: cookies[name] }
        : undefined,
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
  } as unknown as import('next/server').NextRequest;
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

const ORIGINAL_AUTH_STUB = process.env.NEXT_PUBLIC_AUTH_STUB;

beforeEach(() => {
  // Default to non-stub mode for these tests; individual tests opt into stub.
  process.env.NEXT_PUBLIC_AUTH_STUB = 'false';
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

describe('apps/web/proxy.ts — auth guard', () => {
  it('redirects to /?next=<path> when no session cookie and AUTH_STUB!=true', () => {
    const req = makeRequest('/lead/report');
    const response = proxy(req);

    // NextResponse.redirect returns a Response with status 307 and a Location header.
    expect(response.status).toBe(307);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('/?next=');
    // %2F is the URL-encoded form of /
    expect(location).toMatch(/next=%2Flead%2Freport/);
  });

  it('preserves query string in next= param', () => {
    const req = makeRequest('/lead/report', '?period=2026-W17');
    const response = proxy(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location') ?? '';
    // searchParams.set encodes the entire string value, so '?' becomes '%3F'.
    expect(location).toMatch(/next=%2Flead%2Freport%3Fperiod%3D2026-W17/);
  });

  it('passes through when session cookie is present', () => {
    const req = makeRequest('/lead/report', '', {
      customreport_session: 'jwt.token.here',
    });
    const response = proxy(req);

    // NextResponse.next() returns 200 with no Location.
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('passes through when NEXT_PUBLIC_AUTH_STUB=true regardless of cookie', () => {
    process.env.NEXT_PUBLIC_AUTH_STUB = 'true';

    const req = makeRequest('/lead/report'); // no cookie
    const response = proxy(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('apps/web/proxy.ts — config matcher', () => {
  it('exports a config object with a matcher array', () => {
    expect(config).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
    expect((config.matcher as string[]).length).toBeGreaterThan(0);
  });

  it('matcher is a string excluding _next, api, trpc, auth, favicon, and root', () => {
    const matcher = (config.matcher as string[])[0];
    // The matcher uses negative lookahead — sanity check it mentions the right exclusions.
    expect(matcher).toContain('_next');
    expect(matcher).toContain('api');
    expect(matcher).toContain('trpc');
    expect(matcher).toContain('auth');
    expect(matcher).toContain('favicon');
  });
});

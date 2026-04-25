import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 16 proxy.ts — replaces middleware.ts as of Next 16.
 *
 * Auth boundary for v5.0 (AUTH-01..AUTH-04):
 *   - When NEXT_PUBLIC_AUTH_STUB === 'true', everything passes through
 *     (dev/test mode that mirrors the backend's AUTH_DEV_MODE fallback).
 *   - Otherwise, requests to (app)/ routes without the
 *     `customreport_session` cookie are redirected to '/' (the login page)
 *     with the original path preserved as ?next=<encoded path>.
 *
 * The matcher excludes routes that must never trigger a redirect:
 *   - '/'              the login page itself (would cause a loop)
 *   - '/auth/*'        SAML callback + error pages
 *   - '/trpc/*'        tRPC API (proxied to the API service)
 *   - '/api/*'         any remaining REST endpoints
 *   - '/_next/*'       Next.js internals (assets, RSC, HMR)
 *   - '/favicon.ico'   static asset
 *
 * Role separation lives in v6.0 — this file only checks session existence.
 */

const COOKIE_NAME = 'customreport_session';

export default function proxy(request: NextRequest): NextResponse {
  // AUTH_STUB bypass — dev/test mode. Read at request time so test runs that
  // mutate the env take effect without a rebuild.
  if (process.env.NEXT_PUBLIC_AUTH_STUB === 'true') {
    return NextResponse.next();
  }

  if (request.cookies.has(COOKIE_NAME)) {
    return NextResponse.next();
  }

  // No session — redirect to '/' (the login page) with the original path
  // preserved as ?next=<path>. URLSearchParams.set encodes the value, so
  // slashes and query strings are properly escaped.
  const loginUrl = new URL('/', request.url);
  const originalPath =
    request.nextUrl.pathname + (request.nextUrl.search ?? '');
  loginUrl.searchParams.set('next', originalPath);
  return NextResponse.redirect(loginUrl, 307);
}

/**
 * Matcher: run on every route EXCEPT the exemptions above.
 *
 * The negative lookahead `(?!_next|api|trpc|auth|favicon\.ico|$)` excludes:
 *   - any path beginning with one of those prefixes, AND
 *   - the bare '/' route (matched by the `$` alternative — empty after the
 *     leading slash).
 */
export const config = {
  matcher: ['/((?!_next|api|trpc|auth|favicon\\.ico|$).*)'],
};

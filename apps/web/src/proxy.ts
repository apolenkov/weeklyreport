import { type NextRequest, NextResponse } from "next/server";

// Next.js 16 proxy.ts must live HERE (apps/web/src/proxy.ts) because the
// project uses a src/ directory layout (apps/web/src/app/...). Per Next.js
// 16 docs: "Create a proxy.ts file in the project root, or inside `src` if
// applicable, so that it is located at the same level as `pages` or `app`."
// A file at apps/web/proxy.ts (the project root) is silently ignored when
// src/app exists — Phase 27 (QA-01) discovered this empirically.
// Phase 27 (QA-03) earlier moved the file *out* of src/ on the false
// assumption that root-level was canonical; this commit restores the correct
// src/-level location and the original comment from QA-03 is intentionally
// inverted.

/**
 * Next.js 16 proxy.ts — replaces middleware.ts as of Next 16.
 *
 * Auth boundary for v5.0 (AUTH-01..AUTH-04):
 *   - Requests to (app)/ routes without the `customreport_session` cookie
 *     are redirected to '/' (the login page) with the original path
 *     preserved as ?next=<encoded path>.
 *   - Dev stub mode still uses the same route gate. The login page exposes
 *     dev-login user cards; protected pages must not render from the API's
 *     DEV_SESSION fallback without an explicit browser cookie, because that
 *     produced skeleton hangs during manual UAT.
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

const COOKIE_NAME = "customreport_session";

const PROTECTED_PATH_PREFIXES = ["/lead", "/head", "/reports", "/admin"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function proxy(request: NextRequest): NextResponse {
  // Path-based guard: Next.js 16's matcher with negative-lookahead+alternation
  // does not reliably exclude paths, so we filter here in the body. Only
  // run the auth check on protected routes.
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Cookie-shape gate (defense-in-depth, NOT a signature check).
  //
  // We deliberately do NOT verify the JWT signature here — that remains
  // the API's responsibility on every request. The proxy's job is to
  // catch obviously malformed or empty cookies (e.g. stale value from a
  // logout race, manual tampering, an empty string from a buggy
  // Set-Cookie) before incurring an SSR roundtrip.
  //
  // A valid JWT has three base64-encoded segments separated by dots
  // (header.payload.signature). 20 chars is a conservative lower bound
  // (real tokens are several hundred chars); anything shorter is
  // definitionally not a JWT.
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const hasValidCookieShape =
    !!cookieValue &&
    cookieValue.length > 20 &&
    cookieValue.split(".").length === 3;
  if (hasValidCookieShape) {
    return NextResponse.next();
  }

  // No session — redirect to '/' (the login page) with the original path
  // preserved as ?next=<path>. URLSearchParams.set encodes the value, so
  // slashes and query strings are properly escaped.
  const loginUrl = new URL("/", request.url);
  const originalPath = request.nextUrl.pathname + request.nextUrl.search;
  loginUrl.searchParams.set("next", originalPath);
  return NextResponse.redirect(loginUrl, 307);
}

/**
 * Matcher: explicit allowlist of protected route prefixes.
 *
 * Switched from negative-lookahead exclusion to positive allowlist after
 * v5.0 integration tests revealed the lookahead matcher fired on every path
 * (including `/`, `/auth/*`, `/_next/*`, `/favicon.ico`) in Next.js 16.
 * Negative-lookahead with `|` alternation does not appear to work in
 * Next.js 16's matcher; the allowlist is unambiguous and matches the plain
 * reading of PROTECTED_PATH_PREFIXES in the proxy body above.
 */
export const config = {
  matcher: ["/lead/:path*", "/head/:path*", "/reports/:path*", "/admin/:path*"],
};

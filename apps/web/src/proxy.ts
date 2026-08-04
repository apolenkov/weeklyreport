import { type NextRequest, NextResponse } from "next/server";

// Next.js 16 proxy.ts must live HERE (apps/web/src/proxy.ts) because the
// project uses a src/ directory layout (apps/web/src/app/...). Per Next.js
// 16 docs: "Create a proxy.ts file in the project root, or inside `src` if
// applicable, so that it is located at the same level as `pages` or `app`."
// A file at apps/web/proxy.ts (the project root) is silently ignored when
// src/app exists.

// Proxy only gates session-cookie presence; API middleware remains the role and
// signature boundary. Protected prefixes redirect unauthenticated requests.

const COOKIE_NAME = "customreport_session";

const PROTECTED_PATH_PREFIXES = ["/lead", "/head", "/reports", "/admin"];

// A JWT has three base64 segments separated by dots (header.payload.signature).
const JWT_SEGMENT_COUNT = 3;
// Conservative lower bound on a JWT's total length — real tokens run several
// hundred chars; anything shorter is definitionally not a JWT.
const MIN_JWT_LENGTH = 20;

const HTTP_TEMPORARY_REDIRECT = 307;

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
    cookieValue.length > MIN_JWT_LENGTH &&
    cookieValue.split(".").length === JWT_SEGMENT_COUNT;
  if (hasValidCookieShape) {
    return NextResponse.next();
  }

  // No session — redirect to '/' (the login page) with the original path
  // preserved as ?next=<path>. URLSearchParams.set encodes the value, so
  // slashes and query strings are properly escaped.
  const loginUrl = new URL("/", request.url);
  const originalPath = request.nextUrl.pathname + request.nextUrl.search;
  loginUrl.searchParams.set("next", originalPath);
  return NextResponse.redirect(loginUrl, HTTP_TEMPORARY_REDIRECT);
}

// Explicit allowlist avoids Next.js 16 negative-lookahead matcher quirks.
export const config = {
  matcher: ["/lead/:path*", "/head/:path*", "/reports/:path*", "/admin/:path*"],
};

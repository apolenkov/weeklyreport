import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'customreport_session';

const PROTECTED_PATH_PREFIXES = ['/lead', '/head', '/reports', '/admin'];

const PUBLIC_PATH_PREFIXES = ['/auth'];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function buildLoginRedirect(currentUrl: string, loginUrl: string): string {
  const target = new URL(loginUrl);

  target.searchParams.set('redirectTo', currentUrl);

  return target.toString();
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function requiresAuthentication(pathname: string): boolean {
  if (isPublicPath(pathname)) return false;
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function shouldRedirectToLogin(pathname: string, cookies: Record<string, string | undefined>): boolean {
  if (!requiresAuthentication(pathname)) {
    return false;
  }

  return !cookies[AUTH_COOKIE_NAME];
}

export function middleware(request: NextRequest) {
  if (process.env.AUTH_DEV_MODE === 'true' || process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  const cookies = Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  );

  if (shouldRedirectToLogin(request.nextUrl.pathname, cookies)) {
    return NextResponse.redirect(
      new URL(
        buildLoginRedirect(
          request.url,
          `${API_URL}/auth/saml/login`,
        ),
      ),
    );
  }

  return NextResponse.next();
}

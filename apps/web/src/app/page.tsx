'use client';

import { Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

import { useTRPC } from '../lib/trpc-context';

const AUTH_STUB = process.env.NEXT_PUBLIC_AUTH_STUB === 'true';

/**
 * UX-16 (Phase 35-08): role-aware default landing.
 *
 * Previously every visitor was redirected to /head/dashboard, which made
 * leads land on a page they don't have data for and head/admin land on a
 * lead form that returned an infinite skeleton.
 *
 * New behaviour:
 *   - lead          → /lead/report
 *   - head | admin  → /head/dashboard
 *   - viewer        → /reports?tab=published
 *
 * Authentication path:
 *   1. Read auth.me.
 *   2. If a session exists → redirect by role (above table) or honour the
 *      sanitised `next` query param.
 *   3. If AUTH_STUB → stay on the landing page and render the dev-login
 *      picker grid (one card per seeded user, grouped by role). The backend
 *      may return a DEV_SESSION fallback without a cookie; the public landing
 *      page must not treat that fallback as an explicit login.
 *   4. If no session AND not stub → keep the SSO sign-in card.
 */
type Role = 'lead' | 'head' | 'admin' | 'viewer';

const DEFAULT_FOR_ROLE: Record<Role, string> = {
  lead: '/lead/report',
  head: '/head/dashboard',
  admin: '/admin',
  viewer: '/reports?tab=published',
};

const FALLBACK_REDIRECT = '/head/dashboard';

function defaultRedirectFor(role: Role | null | undefined): string {
  if (!role) return FALLBACK_REDIRECT;
  return DEFAULT_FOR_ROLE[role] ?? FALLBACK_REDIRECT;
}

/**
 * Reject open-redirect attempts. The `next` query param must be a
 * same-origin relative path: must start with '/' and must not contain
 * '://' (which would indicate a scheme-relative URL like //evil.com).
 */
function sanitizeNext(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.includes('://')) return fallback;
  if (value.startsWith('//')) return fallback;
  return value;
}

export default function LoginPage() {
  // Next 16 strict prerender: useSearchParams must run inside a Suspense
  // boundary or the / page bails out of static export. Wrap the body so
  // the client-only param read is suspended during prerender.
  return (
    <Suspense fallback={null}>
      <LoginPageBody />
    </Suspense>
  );
}

function LoginPageBody() {
  const searchParams = useSearchParams();
  const trpc = useTRPC();

  // auth.me is publicProcedure — returns null when no session, never
  // throws. Safe to fire on the public landing page.
  const sessionQ = useQuery(trpc.auth.me.queryOptions());
  const session = sessionQ.data ?? null;
  const sessionLoading = sessionQ.isLoading;

  const stayOnLanding = searchParams?.get('stay') === '1';
  const safeNext = sanitizeNext(
    searchParams?.get('next') ?? null,
    defaultRedirectFor(session?.role as Role | undefined),
  );

  // UFB-033: never auto-redirect in AUTH_STUB mode. The API returns a
  // DEV_SESSION fallback when no cookie is present, which previously caused
  // an infinite loop: landing redirects to /head/dashboard → proxy.ts sees
  // no cookie → 307 back to /?next=%2Fhead%2Fdashboard → repeat. In stub
  // mode the explicit "Enter Application" CTA is the only way in (it hits
  // /auth/dev-login which sets the cookie before redirecting). In real-auth
  // mode the auto-redirect remains correct because a session implies a
  // verified cookie.
  useEffect(() => {
    if (AUTH_STUB) return;
    if (sessionLoading || stayOnLanding) return;
    if (!session) return;
    window.location.replace(safeNext);
  }, [session, sessionLoading, safeNext, stayOnLanding]);

  const ssoHref =
    safeNext === FALLBACK_REDIRECT
      ? '/auth/saml/login'
      : `/auth/saml/login?next=${encodeURIComponent(safeNext)}`;

  return (
    <main id="main-content" className="flex min-h-svh">
      {/* Left panel — PEO brand */}
      <div
        className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden p-16 text-white lg:flex"
        style={{
          background:
            'linear-gradient(135deg, #1E3932 0%, #006241 40%, #00754A 70%, #2d8f6f 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 max-w-[400px] text-center">
          <div
            className="font-[family-name:var(--font-sans)] text-[56px] font-extrabold leading-none tracking-[0.08em]"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.15)' }}
          >
            PEO
          </div>
          <div className="mb-8 mt-3 text-sm font-normal uppercase tracking-[0.16em] text-white/70">
            Product Engineering &amp; Operations
          </div>
          <div className="mx-auto mb-8 h-0.5 w-16 rounded-full bg-[var(--color-starbucks-gold)]" />
          <p className="mx-auto max-w-xs text-lg leading-relaxed text-white/60">
            Unified weekly status reporting system for department leads and management
          </p>
        </div>
      </div>

      {/* Right panel — single sign-in CTA. UFB-021: no role grid, default
          to admin in dev-stub mode; role-switch happens after login via
          the in-app dev role switcher. */}
      <div className="relative flex w-full flex-col items-center justify-center bg-white px-6 sm:px-10 lg:w-[480px] lg:flex-none">
        <div className="w-full max-w-[320px] text-center">
          <h1 className="font-[family-name:var(--font-sans)] text-[32px] font-bold tracking-[-0.02em] text-[var(--color-primary)]">
            CustomReport
          </h1>
          <p className="mb-10 mt-2 text-[15px] text-[var(--color-muted-foreground)]">
            Weekly Status Reporting System
          </p>

          <a
            href={
              AUTH_STUB
                ? '/auth/dev-login?role=admin&email=admin@customreport.local&redirect=%2Fadmin'
                : ssoHref
            }
            className="flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-4 font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-white transition-[background-color,opacity,transform] hover:bg-[var(--color-primary)] hover:-translate-y-px active:translate-y-0 active:opacity-90"
            style={{
              minHeight: '52px',
              boxShadow: '0 2px 12px rgba(0,98,65,0.2)',
            }}
            aria-label={
              AUTH_STUB ? 'Enter application as admin' : 'Sign in with corporate SSO'
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            {AUTH_STUB ? 'Enter Application' : 'Sign in with SSO'}
          </a>

          <p className="mt-6 text-xs tracking-[0.02em] text-[var(--color-muted-foreground)]">
            {AUTH_STUB
              ? 'Dev mode · default role: admin · switch role from in-app menu'
              : 'Keycloak · SAML 2.0 · Corporate SSO'}
          </p>

          <div className="mx-auto my-10 h-px w-full max-w-[320px] bg-[#ece8e2]" />

          <p className="text-xs tracking-[0.02em] text-[var(--color-muted-foreground)]">
            CoreDev Department · v8.0
          </p>
        </div>
      </div>
    </main>
  );
}


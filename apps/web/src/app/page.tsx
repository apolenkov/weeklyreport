'use client';

import { Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

import { PulseBackground } from '../components/landing/pulse-background';
import { PulseMark } from '../components/landing/pulse-mark';
import { TaglineCycler } from '../components/landing/tagline-cycler';
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
type Role = 'lead' | 'head' | 'admin' | 'viewer' | 'director';

const DEFAULT_FOR_ROLE: Record<Role, string> = {
  lead: '/lead/report',
  head: '/head/dashboard',
  admin: '/admin',
  viewer: '/reports?tab=published',
  // UFB-057 / Phase 57: director lands on /head/dashboard (same as head)
  // so the product-KPI cards are the first thing they see. The nested
  // /head/dashboard layout permits director read-only.
  director: '/head/dashboard',
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

  // UFB-047 / Phase 48-A: organization identity for the landing hero.
  // `org.getPublic` is a publicProcedure so the anonymous landing page
  // can fetch it without a session. On failure (offline / first-boot)
  // we fall back to the seeded PEO identity so the chrome is never empty.
  //
  // TODO(Phase-59-multi-org): today there is exactly one Organization
  // row (singleton). When Phase 59 ships, `org.getPublic` should be
  // tenant-aware — either derive from the request host (subdomain
  // routing) or from a `/org/<slug>/...` path segment. The PulseMark
  // brand string itself can stay org-scoped because the «Your PULSE?»
  // wordmark is the product brand, not the tenant brand; only the
  // small-caps PEO footnote line below it should swap per tenant.
  // See .planning/phases/59-multi-org-hierarchy/59-CONTEXT.md.
  const orgQ = useQuery(trpc.org.getPublic.queryOptions());
  const orgShortName = orgQ.data?.shortName ?? 'PEO';
  const orgFullName =
    orgQ.data?.fullName ?? 'Product Engineering & Operations';

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
      {/* Left panel — «Your PULSE?» rebrand (UFB-058 / Phase 58).
          PulseBackground renders dark green base + dot grid + ECG line.
          PulseMark + TaglineCycler are positioned above it. The ECG
          track in pulse.css is pinned to top:50% so the trace visually
          passes through the `?` glyph of PulseMark. */}
      <div className="relative hidden flex-1 flex-col items-start justify-center overflow-hidden p-16 text-white lg:flex">
        <PulseBackground />
        <div className="relative z-10 max-w-[480px]">
          <PulseMark />
          <TaglineCycler />
          {/* Quiet PEO footnote — keeps org context for users landing
              from a corporate intranet bookmark. */}
          <p className="mt-10 text-xs uppercase tracking-[0.22em] text-white/40">
            {orgShortName} · {orgFullName}
          </p>
        </div>
      </div>

      {/* Right panel — single sign-in CTA. UFB-021: no role grid, default
          to admin in dev-stub mode; role-switch happens after login via
          the in-app dev role switcher. */}
      <div className="relative flex w-full flex-col items-center justify-center bg-white px-6 sm:px-10 lg:w-[480px] lg:flex-none">
        <div className="w-full max-w-[320px] text-center">
          {/* UFB-058: mobile / right-panel brand. Same PulseMark
              component, scoped down via .pulse-mark-compact wrapper. The
              wrapper inverts colors (gold on white) so the mark stays
              readable on the light sign-in column. */}
          <div className="pulse-mark-compact mb-8 flex justify-center">
            <span
              className="font-[family-name:Fraunces,serif] text-[40px] leading-none text-[var(--color-primary)]"
              style={{
                fontVariationSettings: '"opsz" 144, "wght" 560',
                letterSpacing: '-0.02em',
              }}
            >
              PULSE
              <span
                className="text-[var(--color-starbucks-gold)]"
                style={{ fontVariationSettings: '"opsz" 144, "wght" 660' }}
              >
                ?
              </span>
            </span>
          </div>
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
            {orgFullName} · v8.0
          </p>
        </div>
      </div>
    </main>
  );
}


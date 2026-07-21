"use client";

import {
  DEFAULT_ORGANIZATION_IDENTITY,
  type OrganizationPublic,
} from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PulseBackground, PulseMark, TaglineCycler } from "../features/landing";
import { type LastRoleRecord, readLastRole } from "../lib/last-role";
import { sanitizeNext } from "../lib/safe-next";
import { useTRPC } from "../lib/trpc-context";
import { webEnv } from "../lib/web-env";
import { LastRoleCard, PrimaryCta } from "./login-page-controls";
import {
  defaultRedirectFor,
  FALLBACK_REDIRECT,
  getSessionRole,
  ROLE_LABEL,
} from "./login-page-roles";

const AUTH_STUB = webEnv.authStub();
const APP_VERSION = webEnv.appVersion();

/**
 * Role-aware default landing.
 *
 * Role → default landing:
 *   - lead   → /lead/report
 *   - head   → /head/dashboard
 *   - admin  → /admin
 *   - viewer → /reports/latest  (the Status entry; per viewer-live-status
 *              the viewer is a status observer, so lands on the current
 *              Status report, not the History list)
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
interface LoginPageClientProps {
  initialOrg: OrganizationPublic;
}

function isOrganizationPublic(value: unknown): value is OrganizationPublic {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { shortName?: unknown }).shortName === "string" &&
    typeof (value as { fullName?: unknown }).fullName === "string"
  );
}

export function LoginPageClient({ initialOrg }: LoginPageClientProps) {
  // Next 16 strict prerender: useSearchParams must run inside a Suspense
  // boundary or the / page bails out of static export. Wrap the body so
  // the client-only param read is suspended during prerender.
  return (
    <Suspense fallback={null}>
      <LoginPageBody initialOrg={initialOrg} />
    </Suspense>
  );
}

function LoginPageBody({ initialOrg }: LoginPageClientProps) {
  const searchParams = useSearchParams();
  const trpc = useTRPC();

  // auth.me is publicProcedure — returns null when no session, never
  // throws. Safe to fire on the public landing page.
  const sessionQ = useQuery(trpc.auth.me.queryOptions());
  const sessionRole = getSessionRole(sessionQ.data);
  const hasSession = sessionRole !== undefined;
  const sessionLoading = sessionQ.isLoading;

  // Organization identity for the landing hero. `org.getPublic` is a
  // publicProcedure so the anonymous landing page can fetch it without a
  // session. On failure (offline / first-boot) we fall back to the seeded
  // Demo identity so the chrome is never empty.
  //
  // TODO(multi-org): today there is exactly one Organization row (singleton).
  // When multi-org ships, `org.getPublic` should be tenant-aware — either
  // derive from the request host (subdomain routing) or from a
  // `/org/<slug>/...` path segment. The PulseMark wordmark itself stays
  // org-agnostic because «Weekly Report» names the product artifact, not the
  // tenant brand; only the small-caps Demo footnote line below it should swap
  // per tenant.
  //
  // initialOrg is server-fetched by the RSC wrapper (page.tsx) and passed as
  // a prop so SSR HTML and client first paint agree — no hydration mismatch.
  const orgQ = useQuery({
    ...trpc.org.getPublic.queryOptions(),
    initialData: initialOrg,
  });
  // Fall back to generic DEFAULT_ORGANIZATION_IDENTITY, not a hard-coded
  // brand. Real brand strings live in the Organization row.
  const org = isOrganizationPublic(orgQ.data)
    ? orgQ.data
    : DEFAULT_ORGANIZATION_IDENTITY;
  const orgShortName = org.shortName;
  const orgFullName = org.fullName;

  const stayOnLanding = searchParams.get("stay") === "1";
  const safeNext = sanitizeNext(
    searchParams.get("next") ?? null,
    defaultRedirectFor(sessionRole),
  );

  // «Last session» resume hint. Read from
  // localStorage in a client-only useEffect (never during render /
  // SSR) so the first paint matches the server-rendered HTML and the
  // hint pops in only when hydration has run. AUTH_STUB-only.
  const [lastRole, setLastRole] = useState<LastRoleRecord | null>(null);
  const [lastRoleLoaded, setLastRoleLoaded] = useState(!AUTH_STUB);
  useEffect(() => {
    if (!AUTH_STUB) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-hydration localStorage read: SSR/client first paint must match, then the hint pops in (external store, one-shot)
    setLastRole(readLastRole());
    setLastRoleLoaded(true);
  }, []);

  // Never auto-redirect in AUTH_STUB mode. The API returns a
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
    if (!hasSession) return;
    window.location.replace(safeNext);
  }, [hasSession, sessionLoading, safeNext, stayOnLanding]);

  const ssoHref =
    safeNext === FALLBACK_REDIRECT
      ? "/auth/saml/login"
      : `/auth/saml/login?next=${encodeURIComponent(safeNext)}`;

  return (
    <main id="main-content" className="flex min-h-svh">
      {/* a11y (page-has-heading-one): the landing page's visible brand is the
          graphical PulseMark wordmark, which carries no semantic heading. Give
          the page a single level-one heading for screen readers and document
          outline without altering the visual design. */}
      <h1 className="sr-only">Weekly Report</h1>
      {/* Left panel — «Weekly Report» hero. PulseBackground renders the
          static dark-green base + dot grid. PulseMark + TaglineCycler sit
          above it. */}
      <div className="relative hidden flex-1 flex-col items-start justify-center overflow-hidden p-16 text-white lg:flex">
        <PulseBackground />
        <div className="relative z-10 max-w-[480px]">
          <PulseMark />
          <TaglineCycler />
          {/* Quiet Demo footnote — keeps org context for users landing
              from a corporate intranet bookmark. */}
          <p className="mt-10 text-xs uppercase tracking-[0.22em] text-white/40">
            {orgShortName} · {orgFullName}
          </p>
        </div>
      </div>

      {/* Right panel — single sign-in CTA. No role grid, default to admin in
          dev-stub mode; role-switch happens after login via the in-app dev
          role switcher. */}
      <div className="relative flex w-full flex-col items-center justify-center bg-white px-6 sm:px-10 lg:w-[480px] lg:flex-none">
        <div className="w-full max-w-[320px] text-center">
          {/* Right column carries no brand mark — the left panel already
              shows the «Weekly Report» wordmark at full size, so duplicating
              it on a 480px-wide sign-in column would be visual noise. Right
              column is pure utility: a quiet tagline + the sign-in CTA. The
              Fraunces font import remains because nav-bar may use it for the
              in-app brand-pill once authenticated. */}
          <p className="mb-10 mt-2 text-[15px] text-[var(--color-muted-foreground)]">
            Status Reporting System
          </p>

          <PrimaryCta
            authStub={AUTH_STUB}
            lastRole={lastRole}
            ssoHref={ssoHref}
          />

          <div
            className="mt-6 flex min-h-8 items-start justify-center text-xs leading-4 tracking-[0.02em] text-[var(--color-muted-foreground)]"
            data-testid="last-role-status"
          >
            <p>
              {AUTH_STUB
                ? lastRole
                  ? `Resuming as ${ROLE_LABEL[lastRole.role]} · pick a different role below`
                  : "Dev mode · default role: admin · or pick a role below"
                : "Keycloak · SAML 2.0 · Corporate SSO"}
            </p>
          </div>

          {/* The container always renders at the same height in AUTH_STUB
              mode (see LastRoleCard's shared min-height): a collapse when no
              hint is stored would read as a layout jump (skeleton appears,
              then vanishes), and without a hint the login page would offer NO
              way to pick a role. Skeleton while loading, last-session hint
              when stored, or a direct role picker otherwise. In production
              (AUTH_STUB=false) this block never renders. */}
          {AUTH_STUB && (
            <div className="mt-4">
              <LastRoleCard
                lastRoleLoaded={lastRoleLoaded}
                lastRole={lastRole}
              />
            </div>
          )}

          <div className="mx-auto my-10 h-px w-full max-w-[320px] bg-[#ece8e2]" />

          <p className="text-xs tracking-[0.02em] text-[var(--color-muted-foreground)]">
            {orgFullName}
            {APP_VERSION && <> · v{APP_VERSION}</>}
          </p>
        </div>
      </div>
    </main>
  );
}

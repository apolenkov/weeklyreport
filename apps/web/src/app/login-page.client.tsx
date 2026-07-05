"use client";

import {
  DEFAULT_ORGANIZATION_IDENTITY,
  type OrganizationPublic,
} from "@customreport/shared";
import { Skeleton } from "@customreport/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PulseBackground } from "../components/landing/pulse-background";
import { PulseMark } from "../components/landing/pulse-mark";
import { TaglineCycler } from "../components/landing/tagline-cycler";
import { type LastRoleRecord, readLastRole } from "../lib/last-role";
import { sanitizeNext } from "../lib/safe-next";
import { useTRPC } from "../lib/trpc-context";
import { webEnv } from "../lib/web-env";
import {
  defaultRedirectFor,
  DEV_EMAIL_FOR_ROLE,
  devLoginHref,
  FALLBACK_REDIRECT,
  getSessionRole,
  ROLE_LABEL,
} from "./login-page-roles";

const AUTH_STUB = webEnv.authStub();
const APP_VERSION = webEnv.appVersion();

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
 *   - viewer        → /reports/latest  (the Status entry; viewer-live-status
 *                     made the viewer a status observer, so they land on the
 *                     current Status report, not the History list)
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

  // UFB-047 / Phase 48-A: organization identity for the landing hero.
  // `org.getPublic` is a publicProcedure so the anonymous landing page
  // can fetch it without a session. On failure (offline / first-boot)
  // we fall back to the seeded PEO identity so the chrome is never empty.
  //
  // TODO(Phase-59-multi-org): today there is exactly one Organization
  // row (singleton). When Phase 59 ships, `org.getPublic` should be
  // tenant-aware — either derive from the request host (subdomain
  // routing) or from a `/org/<slug>/...` path segment. The PulseMark
  // wordmark itself stays org-agnostic because «Weekly Report» names the
  // product artifact, not the tenant brand; only the small-caps PEO
  // footnote line below it should swap per tenant.
  // See .planning/phases/59-multi-org-hierarchy/59-CONTEXT.md.
  //
  // UFB-070: initialOrg is server-fetched by the RSC wrapper (page.tsx)
  // and passed as a prop so SSR HTML and client first paint agree — no
  // hydration mismatch.
  const orgQ = useQuery({
    ...trpc.org.getPublic.queryOptions(),
    initialData: initialOrg,
  });
  // UFB-060: fall back to generic DEFAULT_ORGANIZATION_IDENTITY, not a
  // hard-coded brand. Real brand strings live in the Organization row.
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

  // UFB-071 (2026-05-11): «Last session» resume hint. Read from
  // localStorage in a client-only useEffect (never during render /
  // SSR) so the first paint matches the server-rendered HTML and the
  // hint pops in only when hydration has run. AUTH_STUB-only.
  const [lastRole, setLastRole] = useState<LastRoleRecord | null>(null);
  const [lastRoleLoaded, setLastRoleLoaded] = useState(!AUTH_STUB);
  useEffect(() => {
    if (!AUTH_STUB) return;
    setLastRole(readLastRole());
    setLastRoleLoaded(true);
  }, []);

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
    if (!hasSession) return;
    window.location.replace(safeNext);
  }, [hasSession, sessionLoading, safeNext, stayOnLanding]);

  const ssoHref =
    safeNext === FALLBACK_REDIRECT
      ? "/auth/saml/login"
      : `/auth/saml/login?next=${encodeURIComponent(safeNext)}`;

  // All three AUTH_STUB card states (skeleton / last-session hint /
  // role picker) share one min-height — just above the natural height
  // of the tallest state, the role picker (112.5px measured: label +
  // two button rows + padding + border). Equal heights keep the
  // divider and footer below from shifting when hydration swaps one
  // state for another.
  const stubCardClassName =
    "min-h-[113px] rounded-md border border-[#ece8e2] bg-[#fafaf7] px-3 py-2.5 text-left";

  // Always visible in both the last-session hint and the no-hint
  // picker (UFB rev 2026-06-10: the «Change role» toggle expanded the
  // card past its reserved height — another layout jump — so the grid
  // is now permanent and every card state has the same structure).
  const roleOptionsList = (
    <ul
      className="mt-2 grid grid-cols-2 gap-1.5"
      data-testid="last-role-switcher"
    >
      {(["lead", "head", "admin", "viewer"] as const).map((role) => (
        <li key={role}>
          <a
            href={devLoginHref(role, DEV_EMAIL_FOR_ROLE[role])}
            className="block rounded border border-[#ece8e2] bg-white px-2 py-1.5 text-center text-xs font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]"
            data-testid={`last-role-option-${role}`}
          >
            {ROLE_LABEL[role]}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <main id="main-content" className="flex min-h-svh">
      {/* a11y (page-has-heading-one): the landing page's visible brand is the
          graphical PulseMark wordmark, which carries no semantic heading. Give
          the page a single level-one heading for screen readers and document
          outline without altering the visual design. */}
      <h1 className="sr-only">Weekly Report</h1>
      {/* Left panel — «Weekly Report» hero. PulseBackground renders the
          static dark-green base + dot grid (the pulse/ECG motif was
          removed 2026-06-23). PulseMark + TaglineCycler sit above it. */}
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
          {/* UFB-060 (2026-05-11): brand mark removed from the right
              column — the left panel already shows the «Weekly Report»
              wordmark at full size, duplicating it on a 480px wide
              sign-in column was visual noise. Right column is now pure
              utility: a
              quiet tagline + the sign-in CTA. The Fraunces font import
              remains because nav-bar may use it for the in-app
              brand-pill once authenticated. */}
          <p className="mb-10 mt-2 text-[15px] text-[var(--color-muted-foreground)]">
            Status Reporting System
          </p>

          {/* UFB-071: when a last-role hint exists, the primary CTA
              points at that role's dev-login (one-click resume). Falls
              back to admin in stub mode / SSO in real mode. */}
          <a
            href={
              AUTH_STUB
                ? lastRole
                  ? devLoginHref(lastRole.role, lastRole.email)
                  : "/auth/dev-login?role=admin&email=admin@customreport.local&redirect=%2Fadmin"
                : ssoHref
            }
            className="flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-4 font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-white transition-[background-color,opacity,transform] hover:bg-[var(--color-primary)] hover:-translate-y-px active:translate-y-0 active:opacity-90"
            style={{
              minHeight: "52px",
              boxShadow: "0 2px 12px rgba(0,98,65,0.2)",
            }}
            aria-label={
              AUTH_STUB
                ? lastRole
                  ? `Enter application as ${lastRole.name} (${ROLE_LABEL[lastRole.role]})`
                  : "Enter application as admin"
                : "Sign in with corporate SSO"
            }
            data-testid="primary-cta"
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
              aria-hidden="true"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            {AUTH_STUB ? "Enter Application" : "Sign in with SSO"}
          </a>

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

          {/* UFB-071 (rev 2026-06-10, user feedback): the box no longer
              collapses when no hint is stored — the collapse read as a
              layout jump (skeleton appears, then vanishes), and without
              a hint the login page offered NO way to pick a role. The
              container now always renders at the same height in
              AUTH_STUB mode (see stubCardClassName): skeleton while
              loading, last-session hint when stored, or a direct role
              picker otherwise. In production (AUTH_STUB=false) this
              block never renders. */}
          {AUTH_STUB && (
            <div className="mt-4">
              {!lastRoleLoaded ? (
                <div
                  className={stubCardClassName}
                  data-testid="last-role-hint-skeleton"
                  aria-hidden="true"
                >
                  <Skeleton className="h-3.5 w-40" />
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {(["lead", "head", "admin", "viewer"] as const).map(
                      (role) => (
                        <Skeleton key={role} className="h-[30px] rounded" />
                      ),
                    )}
                  </div>
                </div>
              ) : lastRole ? (
                <div className={stubCardClassName} data-testid="last-role-hint">
                  <p className="text-xs leading-snug text-[var(--color-muted-foreground)]">
                    Last session:{" "}
                    <span className="font-semibold text-[var(--color-foreground)]">
                      {lastRole.name}
                    </span>{" "}
                    · {ROLE_LABEL[lastRole.role]}
                  </p>
                  {roleOptionsList}
                </div>
              ) : (
                <div className={stubCardClassName} data-testid="role-picker">
                  <p className="text-xs leading-snug text-[var(--color-muted-foreground)]">
                    Enter as a specific role:
                  </p>
                  {roleOptionsList}
                </div>
              )}
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

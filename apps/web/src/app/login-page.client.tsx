"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import {
  DEFAULT_ORGANIZATION_IDENTITY,
  type OrganizationPublic,
} from "@customreport/shared";
import { Skeleton } from "@customreport/ui/components/ui/skeleton";

import { PulseBackground } from "../components/landing/pulse-background";
import { PulseMark } from "../components/landing/pulse-mark";
import { TaglineCycler } from "../components/landing/tagline-cycler";
import { useTRPC } from "../lib/trpc-context";
import { readLastRole, type LastRoleRecord } from "../lib/last-role";

const AUTH_STUB = process.env.NEXT_PUBLIC_AUTH_STUB === "true";

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
type Role = "lead" | "head" | "admin" | "viewer";

const DEFAULT_FOR_ROLE: Record<Role, string> = {
  lead: "/lead/report",
  head: "/head/dashboard",
  admin: "/admin",
  viewer: "/reports?tab=published",
};

/**
 * UFB-071 (2026-05-11): seeded dev-mode emails per role. The
 * «Change role» dropdown uses these as the fallback email when no
 * persisted hint exists for that role. Must stay in sync with the
 * `emailByRole` table in `apps/api/src/modules/auth/auth.routes.ts`
 * and the seeded users in `prisma/seed-simple.ts`.
 */
const DEV_EMAIL_FOR_ROLE: Record<Role, string> = {
  lead: "lead1@customreport.local",
  head: "head@customreport.local",
  admin: "admin@customreport.local",
  viewer: "viewer@customreport.local",
};

const ROLE_LABEL: Record<Role, string> = {
  lead: "Lead",
  head: "Head",
  admin: "Admin",
  viewer: "Viewer",
};

/**
 * Build the `/auth/dev-login` URL for a given role + email, with the
 * post-login redirect honouring the role's default landing route.
 */
function devLoginHref(role: Role, email: string): string {
  const params = new URLSearchParams({
    role,
    email,
    redirect: DEFAULT_FOR_ROLE[role],
  });
  return `/auth/dev-login?${params.toString()}`;
}

const FALLBACK_REDIRECT = "/head/dashboard";

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
  if (!value.startsWith("/")) return fallback;
  if (value.includes("://")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

type LoginPageClientProps = {
  initialOrg: OrganizationPublic;
};

function isOrganizationPublic(value: unknown): value is OrganizationPublic {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { shortName?: unknown }).shortName === "string" &&
    typeof (value as { fullName?: unknown }).fullName === "string"
  );
}

function isRole(value: unknown): value is Role {
  return (
    value === "lead" ||
    value === "head" ||
    value === "admin" ||
    value === "viewer"
  );
}

function getSessionRole(value: unknown): Role | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const role = (value as { role?: unknown }).role;
  return isRole(role) ? role : undefined;
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
  // we fall back to the seeded Demo identity so the chrome is never empty.
  //
  // TODO(Phase-59-multi-org): today there is exactly one Organization
  // row (singleton). When Phase 59 ships, `org.getPublic` should be
  // tenant-aware — either derive from the request host (subdomain
  // routing) or from a `/org/<slug>/...` path segment. The PulseMark
  // brand string itself can stay org-scoped because the «Your PULSE?»
  // wordmark is the product brand, not the tenant brand; only the
  // small-caps Demo footnote line below it should swap per tenant.
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

  const stayOnLanding = searchParams?.get("stay") === "1";
  const safeNext = sanitizeNext(
    searchParams?.get("next") ?? null,
    defaultRedirectFor(sessionRole),
  );

  // UFB-071 (2026-05-11): «Last session» resume hint. Read from
  // localStorage in a client-only useEffect (never during render /
  // SSR) so the first paint matches the server-rendered HTML and the
  // hint pops in only when hydration has run. AUTH_STUB-only.
  const [lastRole, setLastRole] = useState<LastRoleRecord | null>(null);
  const [lastRoleLoaded, setLastRoleLoaded] = useState(!AUTH_STUB);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
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
          {/* Quiet Demo footnote — keeps org context for users landing
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
              column — the left panel already shows «Your PULSE» at
              full size, duplicating it on a 480px wide sign-in column
              was visual noise. Right column is now pure utility: a
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
                  : "Dev mode · default role: admin · switch role from in-app menu"
                : "Keycloak · SAML 2.0 · Corporate SSO"}
            </p>
          </div>

          {/* UFB-071: last-session hint with «Change role» picker. Only
              rendered in AUTH_STUB mode AND when a hint is stored.
              The container is always present in AUTH_STUB mode so the
              DOM structure is stable across SSR → hydration → useEffect.
              CSS max-height + opacity transition makes the hint slide in
              smoothly instead of causing an instant layout shift.
              In production (AUTH_STUB=false) this block never renders,
              so there is zero flicker on staging/cloud. */}
          {AUTH_STUB && (
            <div
              className="overflow-hidden"
              style={{
                maxHeight: lastRoleLoaded && !lastRole ? "0px" : "300px",
                opacity: lastRoleLoaded && !lastRole ? 0 : 1,
                marginTop: lastRoleLoaded && !lastRole ? "0px" : "16px",
                transition:
                  "max-height 220ms ease-in-out, opacity 220ms ease-in-out, margin-top 220ms ease-in-out",
              }}
              aria-hidden={lastRoleLoaded && !lastRole}
            >
              {!lastRoleLoaded ? (
                <div
                  className="min-h-[63px] rounded-md border border-[#ece8e2] bg-[#fafaf7] px-3 py-2.5 text-left"
                  data-testid="last-role-hint-skeleton"
                  aria-hidden="true"
                >
                  <Skeleton className="h-3.5 w-56" />
                  <Skeleton className="mt-2 h-3.5 w-20" />
                </div>
              ) : lastRole ? (
                <div
                  className="min-h-[63px] rounded-md border border-[#ece8e2] bg-[#fafaf7] px-3 py-2.5 text-left"
                  data-testid="last-role-hint"
                >
                  <p className="text-xs leading-snug text-[var(--color-muted-foreground)]">
                    Last session:{" "}
                    <span className="font-semibold text-[var(--color-foreground)]">
                      {lastRole.name}
                    </span>{" "}
                    · {ROLE_LABEL[lastRole.role]}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRoleSwitcher((v) => !v)}
                    className="mt-1.5 text-xs font-semibold text-[var(--color-starbucks-accent)] underline-offset-2 hover:underline"
                    aria-expanded={showRoleSwitcher}
                    aria-controls="last-role-switcher"
                    data-testid="last-role-change"
                  >
                    {showRoleSwitcher ? "Hide options" : "Change role"}
                  </button>
                  {showRoleSwitcher ? (
                    <ul
                      id="last-role-switcher"
                      className="mt-2 grid grid-cols-2 gap-1.5"
                      data-testid="last-role-switcher"
                    >
                      {(["lead", "head", "admin", "viewer"] as const).map(
                        (role) => (
                          <li key={role}>
                            <a
                              href={devLoginHref(
                                role,
                                DEV_EMAIL_FOR_ROLE[role],
                              )}
                              className="block rounded border border-[#ece8e2] bg-white px-2 py-1.5 text-center text-xs font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]"
                              data-testid={`last-role-option-${role}`}
                            >
                              {ROLE_LABEL[role]}
                            </a>
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          <div className="mx-auto my-10 h-px w-full max-w-[320px] bg-[#ece8e2]" />

          {/* TODO(UFB-061): version string hardcoded. Surface from
              build-time env (NEXT_PUBLIC_APP_VERSION) injected by CI
              so the footer never lies about prod. CLAUDE.md TODO
              discipline rule applies. */}
          <p className="text-xs tracking-[0.02em] text-[var(--color-muted-foreground)]">
            {orgFullName}
          </p>
        </div>
      </div>
    </main>
  );
}

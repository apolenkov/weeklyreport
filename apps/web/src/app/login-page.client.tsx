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

// AUTH_STUB never auto-redirects: DEV_SESSION without cookie would loop with proxy.
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

// Last-role hint: client-only localStorage read so SSR/first paint match.
function useLastRoleHint() {
  const [lastRole, setLastRole] = useState<LastRoleRecord | null>(null);
  const [lastRoleLoaded, setLastRoleLoaded] = useState(!AUTH_STUB);
  useEffect(() => {
    if (!AUTH_STUB) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-hydration localStorage read: SSR/client first paint must match, then the hint pops in (external store, one-shot)
    setLastRole(readLastRole());
    setLastRoleLoaded(true);
  }, []);
  return { lastRole, lastRoleLoaded };
}

// AUTH_STUB: no auto-redirect (DEV_SESSION without cookie loops with proxy).
function useSessionRedirect({
  hasSession,
  sessionLoading,
  safeNext,
  stayOnLanding,
}: {
  readonly hasSession: boolean;
  readonly sessionLoading: boolean;
  readonly safeNext: string;
  readonly stayOnLanding: boolean;
}) {
  useEffect(() => {
    if (AUTH_STUB) return;
    if (sessionLoading || stayOnLanding) return;
    if (!hasSession) return;
    window.location.replace(safeNext);
  }, [hasSession, sessionLoading, safeNext, stayOnLanding]);
}

function HeroPanel({
  orgShortName,
  orgFullName,
}: {
  readonly orgShortName: string;
  readonly orgFullName: string;
}) {
  return (
    <div className="relative hidden flex-1 flex-col items-start justify-center overflow-hidden p-16 text-white lg:flex">
      <PulseBackground />
      <div className="relative z-10 max-w-[480px]">
        <PulseMark />
        <TaglineCycler />
        <p className="mt-10 text-xs uppercase tracking-[0.22em] text-white/40">
          {orgShortName} · {orgFullName}
        </p>
      </div>
    </div>
  );
}

function LastRoleStatus({
  lastRole,
}: {
  readonly lastRole: LastRoleRecord | null;
}) {
  if (!AUTH_STUB) return <p>Keycloak · SAML 2.0 · Corporate SSO</p>;
  return (
    <p>
      {lastRole
        ? `Resuming as ${ROLE_LABEL[lastRole.role]} · pick a different role below`
        : "Dev mode · default role: admin · or pick a role below"}
    </p>
  );
}

function SignInPanel({
  orgFullName,
  lastRole,
  lastRoleLoaded,
  ssoHref,
}: {
  readonly orgFullName: string;
  readonly lastRole: LastRoleRecord | null;
  readonly lastRoleLoaded: boolean;
  readonly ssoHref: string;
}) {
  return (
    <div className="relative flex w-full flex-col items-center justify-center bg-white px-6 sm:px-10 lg:w-[480px] lg:flex-none">
      <div className="w-full max-w-[320px] text-center">
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
          <LastRoleStatus lastRole={lastRole} />
        </div>

        {AUTH_STUB && (
          <div className="mt-4">
            <LastRoleCard lastRoleLoaded={lastRoleLoaded} lastRole={lastRole} />
          </div>
        )}

        <div className="mx-auto my-10 h-px w-full max-w-[320px] bg-[#ece8e2]" />

        <p className="text-xs tracking-[0.02em] text-[var(--color-muted-foreground)]">
          {orgFullName}
          {APP_VERSION && <> · v{APP_VERSION}</>}
        </p>
      </div>
    </div>
  );
}

function LoginPageBody({ initialOrg }: LoginPageClientProps) {
  const searchParams = useSearchParams();
  const trpc = useTRPC();

  // auth.me is publicProcedure — returns null when no session, never
  // throws. Safe to fire on the public landing page.
  const sessionQ = useQuery(trpc.auth.me.queryOptions());
  const sessionRole = getSessionRole(sessionQ.data);

  // initialOrg from RSC keeps SSR and first paint aligned.
  const orgQ = useQuery({
    ...trpc.org.getPublic.queryOptions(),
    initialData: initialOrg,
  });
  // Generic identity fallback — real brand strings live in Organization.
  const org = isOrganizationPublic(orgQ.data)
    ? orgQ.data
    : DEFAULT_ORGANIZATION_IDENTITY;

  const stayOnLanding = searchParams.get("stay") === "1";
  const safeNext = sanitizeNext(
    searchParams.get("next") ?? null,
    defaultRedirectFor(sessionRole),
  );

  const { lastRole, lastRoleLoaded } = useLastRoleHint();
  useSessionRedirect({
    hasSession: sessionRole !== undefined,
    sessionLoading: sessionQ.isLoading,
    safeNext,
    stayOnLanding,
  });

  const ssoHref =
    safeNext === FALLBACK_REDIRECT
      ? "/auth/saml/login"
      : `/auth/saml/login?next=${encodeURIComponent(safeNext)}`;

  return (
    <main id="main-content" className="flex min-h-svh">
      {/* PulseMark is graphical only — sr-only h1 for page-has-heading-one. */}
      <h1 className="sr-only">Weekly Report</h1>
      <HeroPanel orgShortName={org.shortName} orgFullName={org.fullName} />
      <SignInPanel
        orgFullName={org.fullName}
        lastRole={lastRole}
        lastRoleLoaded={lastRoleLoaded}
        ssoHref={ssoHref}
      />
    </main>
  );
}

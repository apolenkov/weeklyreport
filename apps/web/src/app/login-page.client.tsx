"use client";

import type { OrganizationPublic } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useReducer } from "react";

import { PulseBackground, PulseMark, TaglineCycler } from "../features/landing";
import {
  type LastRoleRecord,
  readLastRole,
} from "../shared/lib/auth/last-role";
import { sanitizeNext } from "../shared/lib/navigation/safe-next";
import { getScalarSearchParam } from "../shared/lib/navigation/scalar-search-param";
import { webEnv } from "../shared/lib/runtime/web-env";
import { useTRPC } from "../shared/lib/trpc/trpc-context";
import { LastRoleCard, PrimaryCta } from "./login-page-controls";
import {
  defaultRedirectFor,
  FALLBACK_REDIRECT,
  getSessionRole,
  ROLE_LABEL,
} from "./login-page-roles";

const AUTH_STUB = webEnv.authStub();
const APP_VERSION = webEnv.appVersion();

interface LoginPageClientProps {
  initialOrg: OrganizationPublic;
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
  const [state, load] = useReducer(
    (
      _state: {
        readonly lastRole: LastRoleRecord | null;
        readonly loaded: boolean;
      },
      lastRole: LastRoleRecord | null,
    ) => ({ lastRole, loaded: true }),
    { lastRole: null, loaded: !AUTH_STUB },
  );
  useEffect(() => {
    if (!AUTH_STUB) return;
    load(readLastRole());
  }, []);
  return { lastRole: state.lastRole, lastRoleLoaded: state.loaded };
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
    <div className="relative hidden flex-1 flex-col items-start justify-center overflow-hidden p-16 text-[var(--color-on-dark)] lg:flex">
      <PulseBackground />
      <div className="relative z-10 max-w-[480px]">
        <PulseMark />
        <TaglineCycler />
        <p className="mt-10 text-xs uppercase tracking-[0.22em] text-[var(--color-on-dark)]/40">
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
  if (!AUTH_STUB) return <p>Secure organization sign-in</p>;
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
  sessionError,
}: {
  readonly orgFullName: string;
  readonly lastRole: LastRoleRecord | null;
  readonly lastRoleLoaded: boolean;
  readonly ssoHref: string;
  readonly sessionError: boolean;
}) {
  return (
    <div className="relative flex w-full flex-col items-center justify-center bg-[var(--color-card)] px-6 sm:px-10 lg:w-[480px] lg:flex-none">
      <div className="w-full max-w-[320px] text-center">
        <p className="mb-10 mt-2 text-[15px] text-[var(--color-muted-foreground)]">
          Status Reporting System
        </p>

        {sessionError ? (
          <div
            className="rounded-[var(--radius)] border border-[var(--color-destructive)] p-4 text-sm text-[var(--color-destructive)]"
            role="alert"
            data-testid="landing-session-error"
          >
            Sign-in status could not be verified. Refresh the page to try again.
          </div>
        ) : (
          <PrimaryCta
            authStub={AUTH_STUB}
            lastRole={lastRole}
            ssoHref={ssoHref}
          />
        )}

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

        <div className="mx-auto my-10 h-px w-full max-w-[320px] bg-[var(--color-border-subtle)]" />

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

  // The public session query distinguishes a signed-out response from a
  // transport failure, which the panel reports separately below.
  const sessionQ = useQuery(trpc.auth.me.queryOptions());
  const sessionRole = getSessionRole(sessionQ.data);

  // initialOrg from RSC keeps SSR and first paint aligned, and makes the
  // query data non-nullable: the server helper already resolved an identity.
  const orgQ = useQuery({
    ...trpc.org.getPublic.queryOptions(),
    initialData: initialOrg,
  });
  const org = orgQ.data;

  const stayOnLanding = getScalarSearchParam(searchParams, "stay") === "1";
  const safeNext = sanitizeNext(
    getScalarSearchParam(searchParams, "next"),
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
    <main id="main-content" tabIndex={-1} className="flex min-h-svh">
      {/* PulseMark is graphical only — sr-only h1 for page-has-heading-one. */}
      <h1 className="sr-only">Weekly Report</h1>
      <HeroPanel orgShortName={org.shortName} orgFullName={org.fullName} />
      <SignInPanel
        orgFullName={org.fullName}
        lastRole={lastRole}
        lastRoleLoaded={lastRoleLoaded}
        ssoHref={ssoHref}
        sessionError={sessionQ.isError}
      />
    </main>
  );
}

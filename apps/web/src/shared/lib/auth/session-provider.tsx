"use client";

import { useQuery } from "@tanstack/react-query";
import type { Role, UserSession } from "@weeklyreport/shared";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@weeklyreport/ui/components/ui/alert";
import { Button } from "@weeklyreport/ui/components/ui/button";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";

import { useQueryErrorHandler } from "../../hooks/query/use-query-error-handler";
import { webEnv } from "../runtime/web-env";
import { useTRPC } from "../trpc/trpc-context";
import { writeLastRole } from "./last-role";

// auth.me is publicProcedure so a null session does not trip the 401 redirect;
// the loading boundary stays on this provider rather than on routing.

// sessionRoleSchema includes 'admin' for SAML claim mapping; adminProcedure and
// headProcedure resolve to the same authorization.
export interface SessionUser {
  id: string;
  name: string;
  // Structured ФИО from auth.me; optional for SAML stubs / PDF-export sessions.
  lastName?: string | undefined;
  firstName?: string | undefined;
  middleName?: string | null | undefined;
  email: string;
  role: Role;
  reportingGroupName?: string | undefined;
}

// Hydrated on auth.me for the nav brand; anonymous pages use org.getPublic instead.
interface SessionOrganization {
  shortName: string;
  fullName: string;
}

export interface SessionState {
  user: SessionUser | null;
  organization: SessionOrganization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Exported so tests can opt in to graceful degradation without a provider.
// useSession() still throws when context is absent.
export const SessionContext = createContext<SessionState | null>(null);

function mapSessionState(data: UserSession | null | undefined): SessionState {
  if (!data) {
    // undefined means unresolved — including a pending query whose retry is
    // paused offline or in a background tab, where TanStack reports
    // isLoading false; null means resolved unauthenticated.
    return {
      user: null,
      organization: null,
      isLoading: data === undefined,
      isAuthenticated: false,
    };
  }
  return {
    user: {
      id: data.userId,
      name: data.name,
      lastName: data.lastName,
      firstName: data.firstName,
      middleName: data.middleName,
      email: data.email,
      role: data.role,
      reportingGroupName: data.reportingGroupName,
    },
    // Organization is optional because older JWTs may not carry it.
    organization: data.organization
      ? {
          shortName: data.organization.shortName,
          fullName: data.organization.fullName,
        }
      : null,
    isLoading: false,
    isAuthenticated: true,
  };
}

function SessionLoadError({
  isRetrying,
  onRetry,
}: {
  readonly isRetrying: boolean;
  readonly onRetry: () => void;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-svh items-center justify-center p-6"
    >
      <Alert variant="destructive" className="max-w-md" role="alert">
        <AlertTitle>Could not verify your session.</AlertTitle>
        <AlertDescription>
          WeeklyReport could not load your account. Your data is safe.
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={isRetrying}
            onClick={onRetry}
          >
            {isRetrying ? "Retrying…" : "Try again"}
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC();
  const query = useQuery(trpc.auth.me.queryOptions());
  const { data } = query;
  useQueryErrorHandler(query, {
    component: "SessionProvider",
    event: "auth.session.load_failed",
    procedure: "auth.me",
  });

  const value = useMemo(() => mapSessionState(data), [data]);

  // Client-only write so the landing page can offer a 1-click resume hint.
  useEffect(() => {
    if (!webEnv.authStub() || !value.isAuthenticated || !value.user) return;
    writeLastRole({
      role: value.user.role,
      email: value.user.email,
      name: value.user.name,
    });
  }, [value.isAuthenticated, value.user]);

  if (query.isError) {
    return (
      <SessionLoadError
        isRetrying={query.isFetching}
        onRetry={() => {
          void query.refetch().catch(() => undefined);
        }}
      />
    );
  }

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within <SessionProvider>");
  }
  return ctx;
}

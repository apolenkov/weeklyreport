"use client";

import type { Role, UserSession } from "@customreport/shared";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@customreport/ui/components/ui/alert";
import { Button } from "@customreport/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";

import { useQueryErrorHandler } from "../../hooks/query/use-query-error-handler";
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

function mapSessionState(
  data: UserSession | null | undefined,
  isLoading: boolean,
): SessionState {
  if (!data) {
    // undefined means loading; null means resolved unauthenticated.
    return {
      user: null,
      organization: null,
      isLoading,
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
      className="flex min-h-svh items-center justify-center p-6"
    >
      <Alert variant="destructive" className="max-w-md" role="alert">
        <AlertTitle>Could not verify your session.</AlertTitle>
        <AlertDescription>
          WeeklyReport could not load your account. Your data is safe.
        </AlertDescription>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          disabled={isRetrying}
          onClick={onRetry}
        >
          {isRetrying ? "Retrying…" : "Try again"}
        </Button>
      </Alert>
    </main>
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC();
  const query = useQuery(trpc.auth.me.queryOptions());
  const { data, isLoading } = query;
  useQueryErrorHandler(query, {
    component: "SessionProvider",
    event: "auth.session.load_failed",
    procedure: "auth.me",
  });

  const value = useMemo(
    () => mapSessionState(data, isLoading),
    [data, isLoading],
  );

  // Client-only write so the landing page can offer a 1-click resume hint.
  useEffect(() => {
    if (!value.isAuthenticated || !value.user) return;
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

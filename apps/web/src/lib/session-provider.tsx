"use client";

import type { Role } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";

import { writeLastRole } from "./last-role";
import { useTRPC } from "./trpc-context";

// auth.me is publicProcedure so a null session does not trip the 401 redirect;
// the loading boundary stays on this provider rather than on routing.

// sessionRoleSchema includes 'admin' for SAML claim mapping; adminProcedure === headProcedure for v6.0.
export interface SessionUser {
  id: string;
  name: string;
  // Structured ФИО from auth.me; optional for SAML stubs / PDF-export sessions.
  lastName?: string;
  firstName?: string;
  middleName?: string | null;
  email: string;
  role: Role;
  reportingGroupName?: string;
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.auth.me.queryOptions());

  const value = useMemo<SessionState>(() => {
    if (!data) {
      // data === undefined → still loading
      // data === null     → resolved unauthenticated
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
      // organization is optional in the schema (older JWTs may lack it).
      organization: data.organization
        ? {
            shortName: data.organization.shortName,
            fullName: data.organization.fullName,
          }
        : null,
      isLoading: false,
      isAuthenticated: true,
    };
  }, [data, isLoading]);

  // Client-only write so the landing page can offer a 1-click resume hint.
  useEffect(() => {
    if (!value.isAuthenticated || !value.user) return;
    writeLastRole({
      role: value.user.role,
      email: value.user.email,
      name: value.user.name,
    });
  }, [value.isAuthenticated, value.user]);

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

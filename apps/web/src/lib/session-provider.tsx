"use client";

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

/**
 * SessionProvider — exposes the currently logged-in user across (app)/ pages.
 *
 * Source of truth: `auth.me` tRPC query. Backend returns:
 *   - UserSession with verified cookie (real mode)
 *   - DEV_SESSION when AUTH_DEV_MODE=true and cookie missing (stub mode)
 *   - null when AUTH_DEV_MODE=false and cookie missing (real, unauthenticated)
 *
 * The query uses publicProcedure (does NOT throw on null), so the 401
 * interceptor in trpc.ts will not see UNAUTHORIZED and will not redirect.
 * That keeps the loading boundary on this provider, not on routing.
 */

// The session-level role enum (sessionRoleSchema) includes 'admin' for SAML
// claim mapping. adminProcedure === headProcedure for v6.0.
export interface SessionUser {
  id: string;
  name: string;
  // Structured ФИО parts plumbed from `auth.me`; optional because SAML stubs
  // and the PDF-export session carry only `name`. The nav avatar prefers these
  // for initials and falls back to `name` when absent.
  lastName?: string;
  firstName?: string;
  middleName?: string | null;
  email: string;
  role: "lead" | "head" | "viewer" | "admin";
  reportingGroupName?: string;
}

/**
 * Organization identity hydrated by the API on the `auth.me` response. The
 * nav-bar consumes `organization.shortName` for the brand string; anonymous
 * pages (landing) use `org.getPublic` instead.
 */
export interface SessionOrganization {
  shortName: string;
  fullName: string;
}

export interface SessionState {
  user: SessionUser | null;
  organization: SessionOrganization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Exported so consumer components can opt-in to graceful degradation when
// rendered without a SessionProvider (e.g. narrow unit-test harnesses).
// The canonical hook `useSession()` still throws when context is absent.
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
      // `auth.me` carries the org identity hydrated per-request by the tRPC
      // context factory. The field is optional in the schema (older JWTs may
      // lack it), so the consumer must handle `organization === null`
      // gracefully.
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

  // Persist the last authenticated role + email + name
  // into localStorage so the landing page can offer a 1-click resume hint
  // («You were here as {Name} · {Role} — use this role or change?»).
  // Fire from a useEffect so the write is strictly client-only and never
  // runs during SSR / prerender.
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

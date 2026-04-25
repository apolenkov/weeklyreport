'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useTRPC } from './trpc-context';

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

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: 'lead' | 'head' | 'viewer';
};

export type SessionState = {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.auth.me.queryOptions());

  const value = useMemo<SessionState>(() => {
    if (!data) {
      // data === undefined → still loading
      // data === null     → resolved unauthenticated
      return {
        user: null,
        isLoading,
        isAuthenticated: false,
      };
    }
    return {
      user: {
        id: data.userId,
        name: data.name,
        email: data.email,
        role: data.role,
      },
      isLoading: false,
      isAuthenticated: true,
    };
  }, [data, isLoading]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within <SessionProvider>');
  }
  return ctx;
}

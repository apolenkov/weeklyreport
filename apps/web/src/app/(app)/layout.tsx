import type { ReactNode } from 'react';

import { DevRoleSwitcher } from '../../components/dev/role-switcher';
import { NavBar } from '../../components/navigation/nav-bar';
import { SessionProvider } from '../../lib/session-provider';

type AppGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Route group layout for all authenticated app pages.
 *
 * Wraps NavBar + children in <SessionProvider> so any (app)/ child can call
 * useSession() to read { user, isLoading, isAuthenticated }. The provider
 * itself fetches the current session via the auth.me tRPC query — works
 * identically in stub mode (DEV_SESSION fallback) and real mode (verified
 * cookie). proxy.ts keeps unauthenticated users out before they ever reach
 * this layout (in real mode), so SessionProvider's null branch is mostly a
 * safety net for the brief window before the query resolves.
 */
export default function AppGroupLayout({ children }: AppGroupLayoutProps) {
  return (
    <SessionProvider>
      <NavBar />
      {children}
      <DevRoleSwitcher />
    </SessionProvider>
  );
}

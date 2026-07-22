import type { ReactNode } from "react";

import { SessionProvider } from "../../lib/session-provider";
import { NavBar } from "../../shared/ui/navigation/nav-bar";

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
 * cookie). NavBar owns the loading skeleton that reserves its brand, identity,
 * and action slots while that query resolves. proxy.ts keeps unauthenticated
 * users out before they ever reach this layout in real mode.
 */
export default function AppGroupLayout({ children }: AppGroupLayoutProps) {
  return (
    <SessionProvider>
      <NavBar />
      {children}
    </SessionProvider>
  );
}

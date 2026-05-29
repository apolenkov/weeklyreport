import type { ReactNode } from "react";
import { Suspense } from "react";

import { NavBar } from "../../components/navigation/nav-bar";
import { NavBarSkeleton } from "../../components/navigation/nav-bar-skeleton";
import { SessionProvider } from "../../lib/session-provider";

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
      {/* UFB-065: skeleton fallback eliminates the nav-bar FOUC flash on
          cold reload. NavBarSkeleton matches NavBar height exactly so
          the swap is opacity-only, zero CLS. */}
      <Suspense fallback={<NavBarSkeleton />}>
        <NavBar />
      </Suspense>
      {children}
    </SessionProvider>
  );
}

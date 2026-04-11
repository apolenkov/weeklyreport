import type { ReactNode } from 'react';

type AppGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Route group layout for all authenticated app pages.
 *
 * Currently a passthrough layout. Each page wraps itself with <AppShell>
 * passing role, currentPath, and activeReportId from its own tRPC context.
 *
 * When server-side session extraction is implemented (Phase 10+),
 * this layout will read the session cookie, resolve the user, and
 * provide AppShell here — eliminating per-page wrapper boilerplate.
 */
export default function AppGroupLayout({ children }: AppGroupLayoutProps) {
  return <>{children}</>;
}

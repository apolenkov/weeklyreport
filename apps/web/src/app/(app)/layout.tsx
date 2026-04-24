import type { ReactNode } from 'react';

import { NavBar } from '../../components/navigation/nav-bar';

type AppGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Route group layout for all authenticated app pages.
 *
 * Provides the top navigation bar for all (app) routes.
 * Each page wraps its own content with <main id="main-content">.
 *
 * When server-side session extraction is implemented (Phase 10+),
 * this layout will read the session cookie, resolve the user, and
 * provide full role context — eliminating per-page role inference.
 */
export default function AppGroupLayout({ children }: AppGroupLayoutProps) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}

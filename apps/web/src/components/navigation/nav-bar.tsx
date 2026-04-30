'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

import type { Role } from '@customreport/shared';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@customreport/ui/components/ui/sheet';

import { isRouteVisible } from '../../lib/role-visibility';
import { useSession } from '../../lib/session-provider';

type NavLink = {
  href: string;
  label: string;
};

/**
 * AUTH-06 (Phase 29-06): single canonical link table. Filtered through
 * `isRouteVisible(href, role)` before render, so links the role cannot
 * reach are FILTERED OUT (not CSS-hidden) — a viewer reading the rendered
 * HTML sees no enumeration of /admin or /head routes.
 *
 * Order: lead surfaces first, then head, then reports, then admin —
 * matches the visual hierarchy of the app shell.
 */
const NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: '/lead/report', label: 'My Report' },
  { href: '/lead/history', label: 'History' },
  { href: '/head/dashboard', label: 'Dashboard' },
  { href: '/head/report', label: 'Weekly Report' },
  { href: '/reports/history', label: 'Published reports' },
  { href: '/admin', label: 'Admin' },
];

function getRoleLabel(role: Role): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'head':
      return 'Head';
    case 'lead':
      return 'Lead';
    case 'viewer':
      return 'Viewer';
  }
}

function isActiveLink(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname.startsWith('/admin');
  if (href === '/head/report') return pathname === '/head/report';
  if (href === '/head/dashboard') return pathname === '/head/dashboard';
  return pathname.startsWith(href);
}

function getLogoHref(role: Role): string {
  switch (role) {
    case 'admin':
    case 'head':
      return '/head/dashboard';
    case 'viewer':
      return '/reports/history';
    case 'lead':
    default:
      return '/lead/report';
  }
}

/**
 * Top navigation bar with:
 * - Logo (left)
 * - Role-aware links (center) — filtered via `isRouteVisible`
 * - User info (right)
 *
 * AUTH-06 (Phase 29-06): the link list is hidden BEFORE render — viewers
 * cannot enumerate /admin or /head links from the rendered HTML. The SSR
 * layout gate (Phase 29-03) is the actual security boundary; this is a UX
 * hide only.
 */
export function NavBar() {
  const pathname = usePathname();
  const { user } = useSession();

  // While the session is still loading, render no role-gated links — keeps
  // the seam React-Compiler-safe (no useEffect, no flash) per CC-5 PITFALLS.
  const role: Role | null = user?.role ?? null;
  const visibleLinks: ReadonlyArray<NavLink> =
    role === null
      ? []
      : NAV_LINKS.filter((link) => isRouteVisible(link.href, role));

  return (
    <header className="w-full bg-[var(--color-card)]" data-testid="nav-bar">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a
          href={role ? getLogoHref(role) : '/'}
          className="flex items-center gap-2.5 py-4"
          aria-label="CustomReport home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-starbucks-green)]">
            <span className="text-sm font-bold text-white">C</span>
          </div>
          <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-tight text-[var(--color-foreground)]">
            CustomReport
          </span>
        </a>

        {/* Navigation links — filtered via isRouteVisible(role) */}
        <nav aria-label="Main navigation" className="hidden sm:flex sm:items-center sm:gap-1">
          {visibleLinks.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`relative px-3 py-4 text-sm font-medium transition-colors ${
                  active
                    ? 'text-[var(--color-starbucks-accent)]'
                    : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-starbucks-accent)]" />
                )}
              </a>
            );
          })}
        </nav>

        {/* User info */}
        <div className="flex items-center gap-3">
          {role && (
            <span className="hidden text-xs text-[var(--color-muted-foreground)] sm:inline">
              {getRoleLabel(role)}
            </span>
          )}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-starbucks-green)] text-xs font-semibold text-white"
            aria-label={role ? `Signed in as ${getRoleLabel(role)}` : 'Signed in'}
          >
            {role ? getRoleLabel(role).charAt(0) : '?'}
          </div>
        </div>
      </div>

      {/* Teal bottom border — constrained to content max-w-6xl per D-70 */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="h-[2px] bg-[var(--color-starbucks-accent)]" />
      </div>

      {/* MOB-07 (Phase 30-05): Mobile hamburger menu via shadcn-ui Sheet */}
      <MobileNav links={visibleLinks} pathname={pathname} role={role} />
    </header>
  );
}

// ---- Mobile navigation ----

/**
 * MOB-07 (Phase 30-05): hamburger button + Sheet drawer at sm- viewports.
 * Replaces the prior overflow-x-auto strip — the strip technically fit the
 * viewport but truncated link labels and burned vertical space; a Sheet
 * gives a vertical link list with full-width tap targets.
 */
function MobileNav({
  links,
  pathname,
  role,
}: {
  readonly links: ReadonlyArray<NavLink>;
  readonly pathname: string;
  readonly role: Role | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2 sm:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-md text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          aria-label="Open navigation menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="sr-only">Menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-[var(--color-border)] p-4">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav aria-label="Mobile navigation" className="flex flex-col p-2">
            {links.map((link) => {
              const active = isActiveLink(pathname, link.href);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[var(--color-muted)] text-[var(--color-starbucks-accent)]'
                      : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
      {role && (
        <span className="text-[10px] text-[var(--color-muted-foreground)]">
          {getRoleLabel(role)}
        </span>
      )}
    </div>
  );
}

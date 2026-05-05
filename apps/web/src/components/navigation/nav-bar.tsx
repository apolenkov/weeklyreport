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

const NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: '/lead/report', label: 'My Report' },
  { href: '/lead/history', label: 'History' },
  { href: '/head/dashboard', label: 'Dashboard' },
  { href: '/head/report', label: 'Weekly' },
  { href: '/reports/history', label: 'Archive' },
  { href: '/admin', label: 'Admin' },
];

function getRoleLabel(role: Role): string {
  // Admin is treated as Head in UX (same display label, both have full
  // department-management access). Schema/auth keep them as separate
  // enum values for backwards compat with tests + auth, but the user
  // never sees "Admin" as a distinct label.
  switch (role) {
    case 'admin':
    case 'head':
      return 'Глава департамента';
    case 'lead':
      return 'Тимлид';
    case 'viewer':
      return 'Наблюдатель';
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

// Initials helper — "Polenkov A." → "ПА" (first of first word + first of last
// word), "Olga N." → "ОН", single-word fallback to first 2 chars.
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

// Per-link SVG icons matching mockup s1-s9. 14×14 monoline, currentColor.
function NavIcon({ href }: { readonly href: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (href) {
    case '/lead/report':
      // file with edit pencil — "My Report"
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case '/lead/history':
      // clock — "History"
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case '/head/dashboard':
      // grid — "Dashboard"
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case '/head/report':
      // document with chart bars — "Weekly Report"
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="9" y2="17" />
          <line x1="13" y1="11" x2="13" y2="17" />
          <line x1="17" y1="14" x2="17" y2="17" />
        </svg>
      );
    case '/reports/history':
      // folder/archive — "Published reports"
      return (
        <svg {...common}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case '/admin':
      // gear — "Admin"
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    default:
      return null;
  }
}

export function NavBar() {
  const pathname = usePathname();
  const { user } = useSession();

  const role: Role | null = user?.role ?? null;
  const visibleLinks: ReadonlyArray<NavLink> =
    role === null
      ? []
      : NAV_LINKS.filter((link) => isRouteVisible(link.href, role));

  const initials = user ? initialsFromName(user.name) : '?';
  const roleLabel = role ? getRoleLabel(role) : '';
  // Defensive: if a name happens to match the role label verbatim
  // (legacy seed quirk), show only the name to avoid "X · X".
  const nameRoleSame = user ? user.name === roleLabel : false;

  return (
    <header className="w-full bg-[var(--color-card)]" data-testid="nav-bar">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo — N-1: monogram "CR" on tealA */}
        <a
          href={role ? getLogoHref(role) : '/'}
          className="flex items-center gap-2.5 py-4"
          aria-label="CustomReport home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-starbucks-accent)]">
            <span className="font-[family-name:var(--font-sans)] text-[13px] font-bold tracking-tight text-white">
              CR
            </span>
          </div>
          <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-tight text-[var(--color-foreground)]">
            CustomReport
          </span>
        </a>

        {/* Navigation — N-2: pill active state, N-3: per-link icon.
            whitespace-nowrap on each pill prevents wrapping when the
            right-rail period+avatar squeeze the available width. */}
        <nav aria-label="Main navigation" className="hidden sm:flex sm:items-center sm:gap-0.5">
          {visibleLinks.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-1.5 text-[13px] transition-colors ${
                  active
                    ? 'bg-[var(--color-success)] font-semibold text-[var(--color-starbucks-accent)]'
                    : 'font-medium text-[var(--color-muted-foreground)] hover:bg-[#f8f6f2] hover:text-[var(--color-foreground)]'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <NavIcon href={link.href} />
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* User identity. Right-rail layout strategy:
            - sm-xl (640-1279px): just the avatar circle (with aria-label for
              screen readers carrying name + role)
            - xl+ (1280px+): avatar + "Name · Role" text
            Was previously lg+ (1024px) but at 1024 with 6 nav-link pills + a
            longer RU role label ("Глава департамента") the row overflowed
            ~110px. Bumping the threshold up keeps the chrome tidy while
            preserving the identity signal at every width via the avatar. */}
        <div className="flex items-center gap-2.5">
          {user && (
            <div className="hidden items-center gap-2 xl:flex">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-success)] text-[11px] font-semibold text-[var(--color-starbucks-accent)]"
                aria-hidden="true"
              >
                {initials}
              </div>
              <span className="whitespace-nowrap text-[13px] text-[var(--color-foreground)]">
                <span className="font-semibold">{user.name}</span>
                {!nameRoleSame && (
                  <span className="text-[var(--color-muted-foreground)]"> · {roleLabel}</span>
                )}
              </span>
            </div>
          )}
          {user && (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-success)] text-[11px] font-semibold text-[var(--color-starbucks-accent)] xl:hidden"
              aria-label={`${user.name} (${roleLabel})`}
              title={`${user.name} · ${roleLabel}`}
            >
              {initials}
            </div>
          )}
        </div>
      </div>

      {/* Teal bottom accent — N-6: 3px tealA, rounded top corners. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="h-[3px] rounded-t bg-[var(--color-starbucks-accent)]" />
      </div>

      <MobileNav links={visibleLinks} pathname={pathname} role={role} />
    </header>
  );
}

// ---- Mobile navigation ----

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
                  className={`flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[var(--color-success)] text-[var(--color-starbucks-accent)]'
                      : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <NavIcon href={link.href} />
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

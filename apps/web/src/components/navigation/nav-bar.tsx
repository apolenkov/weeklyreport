'use client';

import { usePathname } from 'next/navigation';

type NavLink = {
  href: string;
  label: string;
};

type InferredRole = 'lead' | 'head' | 'admin';

const LEAD_LINKS: NavLink[] = [
  { href: '/lead/report', label: 'My Report' },
  { href: '/lead/history', label: 'History' },
];

const HEAD_LINKS: NavLink[] = [
  { href: '/head/dashboard', label: 'Dashboard' },
  { href: '/head/report', label: 'Weekly Report' },
];

const ADMIN_LINKS: NavLink[] = [
  { href: '/head/dashboard', label: 'Dashboard' },
  { href: '/head/report', label: 'Weekly Report' },
  { href: '/admin', label: 'Admin' },
];

function inferRole(pathname: string): InferredRole {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/head')) return 'head';
  return 'lead';
}

function getLinksForRole(role: InferredRole): NavLink[] {
  switch (role) {
    case 'admin':
      return ADMIN_LINKS;
    case 'head':
      return HEAD_LINKS;
    case 'lead':
    default:
      return LEAD_LINKS;
  }
}

function getRoleLabel(role: InferredRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'head':
      return 'Head';
    case 'lead':
      return 'Lead';
  }
}

function isActiveLink(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname.startsWith('/admin');
  if (href === '/head/report') return pathname === '/head/report';
  if (href === '/head/dashboard') return pathname === '/head/dashboard';
  return pathname.startsWith(href);
}

/**
 * Top navigation bar with:
 * - Logo (left)
 * - Role-aware links (center)
 * - User info (right)
 * - Teal bottom border constrained to max-w-6xl (D-70)
 */
export function NavBar() {
  const pathname = usePathname();
  const role = inferRole(pathname);
  const links = getLinksForRole(role);

  return (
    <header className="w-full bg-[var(--color-card)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a
          href={role === 'lead' ? '/lead/report' : '/head/dashboard'}
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

        {/* Navigation links */}
        <nav aria-label="Main navigation" className="hidden sm:flex sm:items-center sm:gap-1">
          {links.map((link) => {
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
          <span className="hidden text-xs text-[var(--color-muted-foreground)] sm:inline">
            {getRoleLabel(role)}
          </span>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-starbucks-green)] text-xs font-semibold text-white"
            aria-label={`Signed in as ${getRoleLabel(role)}`}
          >
            {getRoleLabel(role).charAt(0)}
          </div>
        </div>
      </div>

      {/* Teal bottom border — constrained to content max-w-6xl per D-70 */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="h-[2px] bg-[var(--color-starbucks-accent)]" />
      </div>

      {/* Mobile hamburger menu */}
      <MobileNav links={links} pathname={pathname} role={role} />
    </header>
  );
}

// ---- Mobile navigation ----

function MobileNav({
  links,
  pathname,
  role,
}: {
  readonly links: NavLink[];
  readonly pathname: string;
  readonly role: InferredRole;
}) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="flex items-center gap-1 overflow-x-auto border-t border-[var(--color-border)] px-4 sm:hidden"
    >
      {links.map((link) => {
        const active = isActiveLink(pathname, link.href);
        return (
          <a
            key={link.href}
            href={link.href}
            className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-colors ${
              active
                ? 'border-b-2 border-[var(--color-starbucks-accent)] text-[var(--color-starbucks-accent)]'
                : 'text-[var(--color-muted-foreground)]'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {link.label}
          </a>
        );
      })}
      <span className="ml-auto flex-shrink-0 text-[10px] text-[var(--color-muted-foreground)]">
        {getRoleLabel(role)}
      </span>
    </nav>
  );
}

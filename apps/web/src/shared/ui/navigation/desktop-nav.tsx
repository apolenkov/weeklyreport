import type { Role } from "@customreport/shared";
import Link from "next/link";

import { isActiveLink } from "./nav-active";
import { NavIcon } from "./nav-icon";
import type { NavLink } from "./nav-links";

export function DesktopNav({
  links,
  pathname,
  role,
}: {
  readonly links: readonly NavLink[];
  readonly pathname: string;
  readonly role: Role | null;
}) {
  // whitespace-nowrap on each pill prevents wrapping when the right-rail
  // period+avatar squeeze the available width.
  return (
    <nav
      aria-label="Main navigation"
      className="hidden sm:flex sm:items-center sm:gap-0.5"
    >
      {links.map((link) => {
        const active = isActiveLink(pathname, link.href, role);
        return (
          <Link
            key={link.href}
            href={link.href}
            scroll={false}
            title={link.title}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-1.5 text-[13px] transition-colors ${
              active
                ? "bg-[var(--color-success)] font-semibold text-[var(--color-starbucks-accent)]"
                : "font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <NavIcon href={link.href} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

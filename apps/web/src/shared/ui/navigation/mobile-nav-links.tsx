import type { Role } from "@weeklyreport/shared";
import Link from "next/link";

import { isActiveLink } from "./nav-active";
import { NavIcon } from "./nav-icon";
import type { NavLink } from "./nav-links";

export function MobileNavLinks({
  links,
  pathname,
  role,
  onNavigate,
}: {
  readonly links: readonly NavLink[];
  readonly pathname: string;
  readonly role: Role | null;
  readonly onNavigate: () => void;
}) {
  return (
    <nav aria-label="Mobile navigation" className="flex flex-col p-2">
      {links.map((link) => {
        const active = isActiveLink(pathname, link.href, role);
        return (
          <Link
            key={link.href}
            href={link.href}
            scroll={false}
            onClick={onNavigate}
            className={`flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--color-toggle-active)] text-[var(--color-primary-foreground)]"
                : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
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

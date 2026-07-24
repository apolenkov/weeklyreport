"use client";

import {
  DEFAULT_ORGANIZATION_IDENTITY,
  initials as deriveInitials,
  type Role,
  ROLE_LABEL,
} from "@customreport/shared";
import { usePathname } from "next/navigation";

import { useSession } from "../../../lib/session-provider";
import { DesktopNav } from "./desktop-nav";
import { MobileNav } from "./mobile-nav";
import { NavBrand } from "./nav-brand";
import { NAV_LINKS, type NavLink } from "./nav-links";
import { NavRightRail } from "./nav-right-rail";
import { useHydratedClient } from "./use-hydrated-client";

export function NavBar() {
  const pathname = usePathname();
  const { user, organization, isLoading: sessionLoading } = useSession();
  const hydrated = useHydratedClient();

  const visibleUser = hydrated ? user : null;
  const visibleOrganization = hydrated ? organization : null;
  const visibleSessionLoading = sessionLoading || !hydrated;

  const role: Role | null = visibleUser?.role ?? null;
  const visibleLinks: readonly NavLink[] =
    role === null ? [] : NAV_LINKS.filter((link) => link.roles.includes(role));

  const initials = visibleUser
    ? deriveInitials({
        lastName: visibleUser.lastName,
        firstName: visibleUser.firstName,
        name: visibleUser.name,
      }) || "??"
    : "?";
  const roleLabel = role ? ROLE_LABEL[role] : "";
  // Show a skeleton placeholder for the brand pill while the session query
  // is in-flight, instead of flashing the DEFAULT_ORGANIZATION_IDENTITY
  // fallback ('ORG') and then swapping to the real tenant brand ('Demo'). The
  // flash was the «ORG → Demo» pop user saw on every cold reload.
  const orgResolved = !visibleSessionLoading && visibleOrganization !== null;
  const orgShortName = orgResolved
    ? visibleOrganization.shortName
    : DEFAULT_ORGANIZATION_IDENTITY.shortName;
  const homeLabel = visibleUser
    ? `${visibleUser.name} home`
    : "Profile loading";
  const identityMeta = [
    orgResolved ? orgShortName : null,
    visibleUser?.reportingGroupName,
    roleLabel,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <header className="w-full bg-[var(--color-card)]" data-testid="nav-bar">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 sm:px-6 lg:px-8">
        <NavBrand
          role={role}
          homeLabel={homeLabel}
          initials={initials}
          userName={visibleUser ? visibleUser.name : null}
          identityMeta={identityMeta}
          sessionLoading={visibleSessionLoading}
        />

        <DesktopNav links={visibleLinks} pathname={pathname} role={role} />

        <NavRightRail
          sessionLoading={visibleSessionLoading}
          hasUser={visibleUser !== null}
        />
      </div>

      {/* Teal bottom accent — 3px tealA, rounded top corners. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="h-[3px] rounded-t bg-[var(--color-starbucks-accent)]" />
      </div>

      <MobileNav links={visibleLinks} pathname={pathname} role={role} />
    </header>
  );
}

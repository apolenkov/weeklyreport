"use client";

import { usePathname } from "next/navigation";

import { useHydratedClient } from "../../hooks/browser/use-hydrated-client";
import { useSession } from "../../lib/auth/session-provider";
import { DesktopNav } from "./desktop-nav";
import { MobileNav } from "./mobile-nav";
import { buildNavBarModel } from "./nav-bar-model";
import { NavBrand } from "./nav-brand";
import { NavRightRail } from "./nav-right-rail";

export function NavBar() {
  const pathname = usePathname();
  const { user, organization, isLoading: sessionLoading } = useSession();
  const hydrated = useHydratedClient();

  const model = buildNavBarModel({
    user,
    organization,
    sessionLoading,
    hydrated,
  });

  return (
    <header className="w-full bg-[var(--color-card)]" data-testid="nav-bar">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 sm:px-6 lg:px-8">
        <NavBrand
          role={model.role}
          homeLabel={model.homeLabel}
          initials={model.initials}
          userName={model.userName}
          identityMeta={model.identityMeta}
          sessionLoading={model.sessionLoading}
        />

        <DesktopNav
          links={model.visibleLinks}
          pathname={pathname}
          role={model.role}
        />

        <NavRightRail
          sessionLoading={model.sessionLoading}
          hasUser={model.userName !== null}
        />
      </div>

      {/* Teal bottom accent — 3px tealA, rounded top corners. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="h-[3px] rounded-t bg-[var(--color-starbucks-accent)]"
          data-testid="nav-accent"
        />
      </div>

      <MobileNav
        links={model.visibleLinks}
        pathname={pathname}
        role={model.role}
      />
    </header>
  );
}

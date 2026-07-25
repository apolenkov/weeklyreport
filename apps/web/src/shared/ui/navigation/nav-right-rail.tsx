"use client";

import { webEnv } from "../../../lib/web-env";
import { DevRoleSwitcher } from "../role-switcher";
import {
  LanguageComingSoonControl,
  ThemeComingSoonControl,
} from "./coming-soon-controls";
import { NavLogoutButton } from "./nav-logout-button";

const RIGHT_RAIL_CLASS =
  "relative flex items-center justify-end gap-2.5 justify-self-end xl:w-[272px]";

function shouldRenderDevRoleSwitcher() {
  return webEnv.devRoleSwitcher();
}

// Skeleton placeholders hold the header width while the session loads, so the
// rail keeps zero CLS from first paint through auth hydration.
function RightRailSkeleton() {
  return (
    <>
      <div
        className="h-8 w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40 xl:w-[92px]"
        aria-hidden="true"
      />
      <div
        className="h-8 w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40"
        aria-hidden="true"
      />
      <div
        className="h-8 w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40"
        aria-hidden="true"
      />
    </>
  );
}

/**
 * Nav Right Rail.
 * @param options - The options argument.
 */
export function NavRightRail({
  sessionLoading,
  hasUser,
}: {
  readonly sessionLoading: boolean;
  readonly hasUser: boolean;
}) {
  // Actions-only rail. Identity lives in the left home mark + xl text, so the
  // center nav keeps stable space. Language, Theme and Logout stay grouped.
  return (
    <div className={RIGHT_RAIL_CLASS}>
      {sessionLoading ? (
        <RightRailSkeleton />
      ) : (
        <>
          {shouldRenderDevRoleSwitcher() && <DevRoleSwitcher />}
          <ThemeComingSoonControl />
          <LanguageComingSoonControl />
          {hasUser && <NavLogoutButton />}
        </>
      )}
    </div>
  );
}

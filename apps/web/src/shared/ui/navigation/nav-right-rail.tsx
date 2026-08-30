"use client";

import { webEnv } from "../../lib/runtime/web-env";
import { DevRoleSwitcher } from "../auth-runtime/role-switcher";
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
        className="h-[var(--toolbar-control-h)] min-w-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40 xl:w-[92px]"
        aria-hidden="true"
      />
      <div
        className="h-[var(--toolbar-control-h)] min-w-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40"
        aria-hidden="true"
      />
      <div
        className="h-[var(--toolbar-control-h)] min-w-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40"
        aria-hidden="true"
      />
    </>
  );
}

export function NavRightRail({
  sessionLoading,
  hasUser,
}: {
  readonly sessionLoading: boolean;
  readonly hasUser: boolean;
}) {
  // Actions-only rail. Identity lives in the left home mark + xl text, so the
  // Keep the rail limited to actions that are available in the current MVP.
  return (
    <div className={RIGHT_RAIL_CLASS}>
      {sessionLoading ? (
        <RightRailSkeleton />
      ) : (
        <>
          {shouldRenderDevRoleSwitcher() && <DevRoleSwitcher />}
          {hasUser && <NavLogoutButton />}
        </>
      )}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

import { webEnv } from "../../lib/runtime/web-env";
import { DevRoleSwitcher } from "../auth-runtime/role-switcher";
import { NavLogoutButton } from "./nav-logout-button";

const RIGHT_RAIL_CLASS =
  "relative flex items-center justify-end gap-2.5 justify-self-end xl:w-[272px]";

const RIGHT_RAIL_SKELETON_BASE_CLASS =
  "h-[var(--toolbar-control-h)] min-w-[var(--toolbar-control-h)] w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40";

function shouldRenderDevRoleSwitcher() {
  return webEnv.devRoleSwitcher();
}

// Skeleton placeholders hold the header width while the session loads, so the
// rail keeps zero CLS from first paint through auth hydration.
function RightRailSkeleton() {
  return (
    <>
      <div
        className={`${RIGHT_RAIL_SKELETON_BASE_CLASS} xl:w-[92px]`}
        aria-hidden="true"
      />
      <div className={RIGHT_RAIL_SKELETON_BASE_CLASS} aria-hidden="true" />
      <div className={RIGHT_RAIL_SKELETON_BASE_CLASS} aria-hidden="true" />
    </>
  );
}

export function NavRightRail({
  sessionLoading,
  hasUser,
  menu,
}: {
  readonly sessionLoading: boolean;
  readonly hasUser: boolean;
  // Compact-viewport navigation trigger; sits last so it ends the rail.
  readonly menu?: ReactNode;
}) {
  // The rail contains actions only; identity lives in the left home mark and
  // the expanded navigation text. Keep it limited to currently available actions.
  return (
    <div className={RIGHT_RAIL_CLASS}>
      {sessionLoading ? (
        <RightRailSkeleton />
      ) : (
        <>
          {shouldRenderDevRoleSwitcher() && <DevRoleSwitcher />}
          {hasUser && <NavLogoutButton />}
          {hasUser && menu}
        </>
      )}
    </div>
  );
}

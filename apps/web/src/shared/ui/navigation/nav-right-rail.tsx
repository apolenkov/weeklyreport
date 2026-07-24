"use client";

import { webEnv } from "../../../lib/web-env";
import { DevRoleSwitcher } from "../role-switcher";
import {
  LanguageComingSoonControl,
  ThemeComingSoonControl,
} from "./coming-soon-controls";

const RIGHT_RAIL_CLASS =
  "relative flex items-center justify-end gap-2.5 justify-self-end xl:w-[272px]";
const LOGOUT_BUTTON_CLASS =
  "inline-flex h-8 w-10 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-0 text-[12px] font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-foreground)]";

function shouldRenderDevRoleSwitcher() {
  return webEnv.devRoleSwitcher();
}

export function NavRightRail({
  sessionLoading,
  hasUser,
}: {
  readonly sessionLoading: boolean;
  readonly hasUser: boolean;
}) {
  // Right rail. Identity lives in the left home mark + xl text, so the
  // rail keeps only actions and the center nav has stable space.
  // Skeleton placeholders show while the session is loading so the
  // header width is stable from first paint → zero CLS on reload.
  // Language, Theme and Logout stay grouped as the action rail.
  return (
    <div className={RIGHT_RAIL_CLASS}>
      {sessionLoading ? (
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
      ) : (
        <>
          {shouldRenderDevRoleSwitcher() && <DevRoleSwitcher />}
          <ThemeComingSoonControl />
          <LanguageComingSoonControl />
          {hasUser && (
            <button
              type="button"
              onClick={() => {
                // Redirect home only after the server confirms logout. A
                // non-OK response or a rejected request leaves the session
                // cookie intact, so staying on the page is the honest state.
                void fetch("/auth/logout", {
                  method: "POST",
                  credentials: "include",
                }).then((response) => {
                  if (response.ok) window.location.href = "/";
                });
              }}
              data-testid="nav-logout"
              aria-label="Sign out"
              title="Sign out"
              className={LOGOUT_BUTTON_CLASS}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}

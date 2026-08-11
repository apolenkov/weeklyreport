"use client";

import { toast } from "sonner";

import { logoutThenRedirect } from "../../lib/navigation/logout-then-redirect";

const LOGOUT_BUTTON_CLASS =
  "inline-flex h-[var(--toolbar-control-h)] min-w-[var(--toolbar-control-h)] w-10 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-0 text-[12px] font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-foreground)]";

export function NavLogoutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        logoutThenRedirect("/", () => {
          toast.error("Sign out failed. You are still signed in.");
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
  );
}

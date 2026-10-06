"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { logoutThenRedirect } from "../../lib/navigation/logout-then-redirect";

// Shared by every icon action in the header rail so they keep one footprint.
export const NAV_RAIL_BUTTON_CLASS =
  "inline-flex h-[var(--toolbar-control-h)] min-w-[var(--toolbar-control-h)] w-10 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-0 text-[12px] font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-foreground)]";

export function NavLogoutButton() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        setPending(true);
        const started = logoutThenRedirect(queryClient, "/", () => {
          setPending(false);
          toast.error("Sign out failed. You are still signed in.");
        });
        if (!started) setPending(false);
      }}
      data-testid="nav-logout"
      aria-label="Sign out"
      title="Sign out"
      className={NAV_RAIL_BUTTON_CLASS}
    >
      {pending ? (
        <LoaderCircle
          className="size-3.5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
          data-testid="nav-logout-spinner"
        />
      ) : (
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
          data-testid="nav-logout-icon"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )}
    </button>
  );
}

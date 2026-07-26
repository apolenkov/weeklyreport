"use client";

import { PlusIcon } from "../../../shared/ui/icons";

interface RemindersEmptyStateProps {
  /** `true` when there are no policies at all (vs. an empty search result). */
  readonly hasNoPolicies: boolean;
  readonly onCreate: () => void;
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-[var(--color-muted-foreground)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}

export function RemindersEmptyState({
  hasNoPolicies,
  onCreate,
}: RemindersEmptyStateProps) {
  return (
    <div
      data-testid="reminders-empty-state"
      className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center"
    >
      {hasNoPolicies ? (
        <>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-border)]">
            <BellIcon />
          </div>
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            No reminders yet
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Reminders fire automatically before each deadline — for every period
            inside the validity window.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="btn-press mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.25)] bg-[rgba(0,117,74,0.08)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-success)]"
          >
            <PlusIcon />
            Create first reminder
          </button>
        </>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No reminders match the search.
        </p>
      )}
    </div>
  );
}

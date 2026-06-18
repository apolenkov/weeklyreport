"use client";

import { useState } from "react";

import { ConfirmDeleteDialog } from "../lead/confirm-delete-dialog";

interface PublishLockButtonProps {
  readonly pendingCount: number;
  readonly totalLeads: number;
  /**
   * Period lifecycle state. Drives the visible action: when `open` or
   * `reopened`, the button shows "Publish & Lock"; when `published`, it shows
   * "Reopen Period".
   */
  readonly periodStatus: "open" | "published" | "reopened";
  /** Invoked after the user confirms the publish dialog. */
  readonly onPublish: () => void;
  /** Invoked after the user confirms the reopen dialog. Reopen is destructive
   * — it unlocks an already-published period — so it now goes through a
   * confirm gate matching the rest of the app's destructive-action UX. */
  readonly onReopen: () => void;
  /** Disable the trigger while the parent's mutation is in-flight. */
  readonly isPending?: boolean;
  /** Guard against publishing an empty period. */
  readonly canPublish?: boolean;
  readonly publishDisabledReason?: string;
}

export function PublishLockButton({
  pendingCount,
  totalLeads,
  periodStatus,
  onPublish,
  onReopen,
  isPending = false,
  canPublish = true,
  publishDisabledReason = "No submitted report content yet.",
}: PublishLockButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);

  function handleConfirm() {
    if (!canPublish) return;
    setShowDialog(false);
    onPublish();
  }

  function handleConfirmReopen() {
    setShowReopenDialog(false);
    onReopen();
  }

  if (periodStatus === "published") {
    return (
      <>
        <button
          type="button"
          className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setShowReopenDialog(true)}
          disabled={isPending}
          aria-label="Reopen Period"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            stroke="currentColor"
            fill="none"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          Reopen Period
        </button>

        <ConfirmDeleteDialog
          open={showReopenDialog}
          title="Reopen this period?"
          preview="The published report will be unlocked."
          subtitle="Leads will be able to edit their sections again."
          consequence="The current published version will be replaced when you publish again."
          confirmLabel="Reopen"
          reversible
          onConfirm={handleConfirmReopen}
          onCancel={() => setShowReopenDialog(false)}
        />
      </>
    );
  }

  const publishDisabled = isPending || !canPublish;

  return (
    <>
      <button
        type="button"
        className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          if (canPublish) setShowDialog(true);
        }}
        disabled={publishDisabled}
        aria-disabled={publishDisabled}
        title={!canPublish ? publishDisabledReason : undefined}
      >
        {canPublish ? "Publish & Lock" : "Nothing to publish"}
      </button>

      {showDialog && canPublish && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm publish"
            tabIndex={-1}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowDialog(false);
            }}
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Publish & Lock Report?
            </h3>

            {pendingCount > 0 ? (
              <div className="mt-3 rounded-lg border border-[rgba(212,160,23,0.2)] bg-[#fffbeb] p-3">
                <p className="text-sm font-medium text-[#8a6d1b]">
                  {pendingCount} of {totalLeads} leads haven&apos;t submitted
                  yet.
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Their sections will appear empty in the published report.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                All {totalLeads} leads have submitted. The report is ready to
                publish.
              </p>
            )}

            <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
              Once published, all lead forms will be locked and no further edits
              can be made for this period.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
                onClick={() => setShowDialog(false)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleConfirm}
                disabled={publishDisabled}
              >
                {pendingCount > 0 ? "Publish Anyway" : "Publish & Lock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

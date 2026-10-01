"use client";

import type { PeriodStatus } from "@customreport/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConfirmDeleteDialog } from "../../../shared/ui/dialogs/confirm-delete-dialog";

interface PublishLockButtonProps {
  readonly pendingCount: number;
  readonly totalLeads: number;
  readonly periodStatus: PeriodStatus;
  // The focus hand-off is armed only by `onSuccess`: a failed mutation must not
  // leave a request that a later foreign status change would consume.
  readonly onPublish: (onSuccess: () => void) => void;
  // Reopen unlocks a published period — confirm gate for a destructive action.
  readonly onReopen: (onSuccess: () => void) => void;
  readonly isPending?: boolean;
  readonly canPublish?: boolean;
  readonly publishDisabledReason?: string;
}

// Published periods expose reopen instead of publish; the confirm state lives
// here because this control only ever mounts on that branch.
function ReopenPeriodControl({
  onReopen,
  isPending,
  takeFocusRequest,
}: {
  readonly onReopen: () => void;
  readonly isPending: boolean;
  readonly takeFocusRequest: () => boolean;
}) {
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // The Publish button this replaces held focus; hand it to the successor once.
  useEffect(() => {
    if (takeFocusRequest()) buttonRef.current?.focus();
  }, [takeFocusRequest]);

  function handleConfirmReopen() {
    setShowReopenDialog(false);
    onReopen();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setShowReopenDialog(true)}
        disabled={isPending}
        aria-label="Reopen period"
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
        Reopen period
      </button>

      <ConfirmDeleteDialog
        open={showReopenDialog}
        title="Reopen this period?"
        preview="The published report will be unlocked."
        subtitle="Leads can edit their sections again. Sections they already submitted return to draft and must be submitted again."
        consequence="The current published version will be replaced when you publish again."
        confirmLabel="Reopen"
        reversible
        onConfirm={handleConfirmReopen}
        onCancel={() => setShowReopenDialog(false)}
      />
    </>
  );
}

// Reopening can be refused (disabled in settings, window expired) and the
// weekly-report read model does not expose that, so no reversibility claim.
function PublishConfirmDialog({
  open,
  pendingCount,
  totalLeads,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly pendingCount: number;
  readonly totalLeads: number;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <ConfirmDeleteDialog
      open={open}
      title="Publish & lock report?"
      preview={
        pendingCount > 0
          ? `${pendingCount} of ${totalLeads} leads haven't submitted yet.`
          : `All ${totalLeads} leads have submitted. The report is ready to publish.`
      }
      subtitle={
        pendingCount > 0
          ? "Their sections will appear empty in the published report."
          : undefined
      }
      consequence="Leads can no longer edit this period."
      confirmLabel={pendingCount > 0 ? "Publish anyway" : "Publish & lock"}
      tone="primary"
      showReversibility={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export function PublishLockButton({
  pendingCount,
  totalLeads,
  periodStatus,
  onPublish,
  onReopen,
  isPending = false,
  canPublish = true,
  publishDisabledReason = "Publish requires at least one submitted section.",
}: PublishLockButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  const focusPublishRef = useRef(false);
  const focusReopenRef = useRef(false);
  const takeFocusRequest = useCallback(() => {
    const requested = focusReopenRef.current;
    focusReopenRef.current = false;
    return requested;
  }, []);

  // Reopening swaps Reopen period for Publish & lock, which held focus. The
  // button is disabled while nothing is submitted (reopen resets sections to
  // draft), so fall back to the page rather than dropping focus to <body>.
  useEffect(() => {
    if (periodStatus === "published" || !focusPublishRef.current) return;
    focusPublishRef.current = false;
    const button = publishButtonRef.current;
    if (button && !button.disabled) button.focus();
    else document.getElementById("main-content")?.focus();
  }, [periodStatus]);

  function handleReopen() {
    onReopen(() => {
      focusPublishRef.current = true;
    });
  }

  function handleConfirm() {
    if (!canPublish) return;
    setShowDialog(false);
    onPublish(() => {
      focusReopenRef.current = true;
    });
  }

  if (periodStatus === "published") {
    return (
      <ReopenPeriodControl
        onReopen={handleReopen}
        isPending={isPending}
        takeFocusRequest={takeFocusRequest}
      />
    );
  }

  const publishDisabled = isPending || !canPublish;

  return (
    <>
      <button
        ref={publishButtonRef}
        type="button"
        className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          if (canPublish) setShowDialog(true);
        }}
        disabled={publishDisabled}
        aria-disabled={publishDisabled}
        title={!canPublish ? publishDisabledReason : undefined}
      >
        {canPublish ? "Publish & lock" : "Nothing to publish"}
      </button>

      <PublishConfirmDialog
        open={showDialog && canPublish}
        pendingCount={pendingCount}
        totalLeads={totalLeads}
        onConfirm={handleConfirm}
        onCancel={() => setShowDialog(false)}
      />
    </>
  );
}

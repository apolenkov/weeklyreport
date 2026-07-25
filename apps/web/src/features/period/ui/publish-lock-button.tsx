"use client";

import type { PeriodStatus } from "@customreport/shared";
import { useState } from "react";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";

interface PublishLockButtonProps {
  readonly pendingCount: number;
  readonly totalLeads: number;
  readonly periodStatus: PeriodStatus;
  readonly onPublish: () => void;
  // Reopen unlocks a published period — confirm gate for a destructive action.
  readonly onReopen: () => void;
  readonly isPending?: boolean;
  readonly canPublish?: boolean;
  readonly publishDisabledReason?: string;
}

// Published periods expose reopen instead of publish; the confirm state lives
// here because this control only ever mounts on that branch.
function ReopenPeriodControl({
  onReopen,
  isPending,
}: {
  readonly onReopen: () => void;
  readonly isPending: boolean;
}) {
  const [showReopenDialog, setShowReopenDialog] = useState(false);

  function handleConfirmReopen() {
    setShowReopenDialog(false);
    onReopen();
  }

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
      title="Publish & Lock Report?"
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
      consequence="Once published, all lead forms will be locked and no further edits can be made for this period."
      confirmLabel={pendingCount > 0 ? "Publish Anyway" : "Publish & Lock"}
      tone="primary"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

/**
 * Publish Lock Button.
 * @param props - The props argument.
 */
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

  function handleConfirm() {
    if (!canPublish) return;
    setShowDialog(false);
    onPublish();
  }

  if (periodStatus === "published") {
    return <ReopenPeriodControl onReopen={onReopen} isPending={isPending} />;
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

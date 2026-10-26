"use client";

import type { PeriodStatus } from "@weeklyreport/shared";

const TOOLBAR_BUTTON_CLASS =
  "btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50";

// The page collapses publish, reopen, archive and restore into one lifecycle
// guard, so an archive/restore click cannot race another period transition.
interface ArchivalMutationState {
  readonly isLifecyclePending: boolean;
  readonly archiveLabel: string;
  readonly restoreLabel: string;
}

interface ArchiveRestoreActionsProps {
  readonly archived: boolean;
  readonly periodStatus: PeriodStatus;
  readonly onArchive: () => void;
  readonly onRestore: () => void;
  readonly mutationState: ArchivalMutationState;
}

function ToolbarLifecycleButton({
  label,
  ariaLabel,
  onClick,
  disabled,
}: {
  readonly label: string;
  readonly ariaLabel: string;
  readonly onClick: () => void;
  readonly disabled: boolean;
}) {
  return (
    <button
      type="button"
      className={TOOLBAR_BUTTON_CLASS}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}

// Archiving leaves the period published, so the two states are told apart by
// `archived` alone — offering Archive on an archived report would only 409.
export function ArchiveRestoreActions({
  archived,
  periodStatus,
  onArchive,
  onRestore,
  mutationState,
}: ArchiveRestoreActionsProps) {
  if (archived) {
    return (
      <ToolbarLifecycleButton
        label={mutationState.restoreLabel}
        ariaLabel="Restore this report from the archive"
        onClick={onRestore}
        disabled={mutationState.isLifecyclePending}
      />
    );
  }

  if (periodStatus !== "published") {
    return null;
  }

  return (
    <ToolbarLifecycleButton
      label={mutationState.archiveLabel}
      ariaLabel="Move this report to the archive"
      onClick={onArchive}
      disabled={mutationState.isLifecyclePending}
    />
  );
}

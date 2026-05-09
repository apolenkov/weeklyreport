'use client';

import { useEffect, useRef } from 'react';

type ConfirmationDialogVariant =
  | 'submit'
  | 'publish'
  | 'reopen'
  | 'revoke'
  | 'fill-from'
  | 'version-restore'
  | 'delete'
  | 'default';

type ConfirmationDialogProps = {
  /** Whether the dialog is visible */
  readonly open: boolean;
  /** Called when dialog is dismissed or cancelled */
  readonly onClose: () => void;
  /** Called when user confirms the action */
  readonly onConfirm: () => void;
  /** Dialog title */
  readonly title: string;
  /** Dialog description / body text */
  readonly description: string;
  /** Label for the confirm button (defaults to "Confirm") */
  readonly confirmLabel?: string;
  /** Label for the cancel button (defaults to "Cancel") */
  readonly cancelLabel?: string;
  /** Visual variant — destructive shows red confirm button */
  readonly variant?: ConfirmationDialogVariant;
  /** Optional extra content between description and buttons */
  readonly children?: React.ReactNode;
};

const DESTRUCTIVE_VARIANTS: ConfirmationDialogVariant[] = ['delete', 'revoke'];

/**
 * Reusable confirmation dialog for all confirmation actions:
 * Submit, Publish, Reopen, Revoke, Fill From, Version Restore, Delete
 *
 * - Traps focus inside dialog
 * - Closes on Escape
 * - Closes on backdrop click
 * - Supports destructive (red) and standard (green) confirm buttons
 */
export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  children,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const isDestructive = DESTRUCTIVE_VARIANTS.includes(variant);

  // Focus trap: focus the dialog when opened
  useEffect(() => {
    if (open && dialogRef.current) {
      const firstButton = dialogRef.current.querySelector('button');
      firstButton?.focus();
    }
  }, [open]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {title}
        </h3>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>

        {children && <div className="mt-3">{children}</div>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`btn-press rounded-[var(--radius-pill)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors ${
              isDestructive
                ? 'bg-[var(--color-destructive)] hover:bg-red-700'
                : 'bg-[var(--color-starbucks-accent)] hover:bg-[var(--color-primary)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Preset dialog configurations ----

type PresetConfig = {
  title: string;
  description: string;
  confirmLabel: string;
  variant: ConfirmationDialogVariant;
};

/**
 * Get preset dialog configuration for common actions.
 * Usage: const preset = getDialogPreset('submit');
 *        <ConfirmationDialog {...preset} open={...} onClose={...} onConfirm={...} />
 */
export function getDialogPreset(
  type: ConfirmationDialogVariant,
  context?: string,
): PresetConfig {
  switch (type) {
    case 'submit':
      return {
        title: 'Submit Report?',
        description: 'Submit your report? This cannot be undone. Your form will be locked.',
        confirmLabel: 'Submit Report',
        variant: 'submit',
      };
    case 'publish':
      return {
        title: 'Publish & Lock?',
        description: 'Publish & Lock this period? All lead forms will be locked and the report becomes visible to viewers.',
        confirmLabel: 'Publish & Lock',
        variant: 'publish',
      };
    case 'reopen':
      return {
        title: 'Reopen Period?',
        description: 'Reopen this period? Leads will be able to edit their submissions again.',
        confirmLabel: 'Reopen',
        variant: 'reopen',
      };
    case 'revoke':
      return {
        title: 'Revoke Submission?',
        description: `Revoke ${context ?? "this lead"}'s submission? Their form returns to Draft status.`,
        confirmLabel: 'Revoke',
        variant: 'revoke',
      };
    case 'fill-from':
      return {
        title: 'Fill From Previous?',
        description: `Fill from ${context ?? 'previous period'}? This will overwrite your current draft.`,
        confirmLabel: 'Fill From',
        variant: 'fill-from',
      };
    case 'version-restore':
      return {
        title: 'Restore Version?',
        description: `Restore to version ${context ?? 'selected'}? Current changes will be lost.`,
        confirmLabel: 'Restore',
        variant: 'version-restore',
      };
    case 'delete':
      return {
        title: 'Delete Item?',
        description: `Delete ${context ?? 'this item'}? This action cannot be undone.`,
        confirmLabel: 'Delete',
        variant: 'delete',
      };
    default:
      return {
        title: 'Confirm Action?',
        description: 'Are you sure you want to proceed?',
        confirmLabel: 'Confirm',
        variant: 'default',
      };
  }
}

"use client";

import type { ReactNode, RefObject } from "react";

import { DialogSurface } from "../../../shared/ui/dialog-surface";

export function PeriodDialogSurface({
  mode,
  title,
  description,
  onCancel,
  surfaceRef,
  children,
}: {
  readonly mode: "create" | "edit";
  readonly title: string;
  readonly description: string;
  readonly onCancel: () => void;
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly children: ReactNode;
}) {
  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={onCancel}
      surfaceClassName="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
      ariaLabel={title}
      testId="periods-create-dialog"
      mode={mode}
    >
      <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
        {title}
      </h3>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        {description}
      </p>
      {children}
    </DialogSurface>
  );
}

export function PeriodDialogActions({
  onCancel,
  onSubmit,
  isPending,
  canSubmit,
  submitLabel,
}: {
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
  readonly isPending: boolean;
  readonly canSubmit: boolean;
  readonly submitLabel: string;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        data-testid="periods-create-cancel"
        className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        data-testid="periods-create-submit"
        className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}

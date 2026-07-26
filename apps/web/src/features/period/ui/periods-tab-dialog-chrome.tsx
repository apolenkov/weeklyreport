"use client";

import type { ReactNode, RefObject } from "react";

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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
      data-testid="periods-create-dialog"
      data-dialog-mode={mode}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops propagation to the backdrop; not a user interaction, no keyboard equivalent applies */}
      <div
        ref={surfaceRef}
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {title}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
        {children}
      </div>
    </div>
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
        className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        data-testid="periods-create-submit"
        className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}

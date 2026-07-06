"use client";

import { createPortal } from "react-dom";

import type { ReportPeriod } from "../../report-sections/model/mock-data";

interface FillFromConfirmDialogProps {
  readonly open: boolean;
  readonly selectedPeriod: ReportPeriod | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Confirmation dialog shown before a fill-from overwrite (FillFromButton).
 * Portals to document.body so ancestor transform/filter does not break
 * position:fixed containment.
 */
export function FillFromConfirmDialog({
  open,
  selectedPeriod,
  onConfirm,
  onCancel,
}: FillFromConfirmDialogProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm fill from previous"
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          Fill from {selectedPeriod?.weekLabel}?
        </h3>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          This will overwrite your current draft with data from{" "}
          <strong>
            {selectedPeriod?.weekLabel} ({selectedPeriod?.dateRange})
          </strong>
          . Current Week items, Risks, and Decisions will be replaced.
          Priorities will NOT be filled.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            onClick={onConfirm}
          >
            Replace &amp; Fill
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

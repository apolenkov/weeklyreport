"use client";

import { SaveNowButton } from "../../../../../shared/ui/report-shell/save-now-button";
import type { AutosaveSnapshot } from "../../../../report-sections/client";
import { QuickAddButton, type QuickAddKind } from "./quick-add-button";

export interface LeadCompletionActionContract {
  readonly autosave: AutosaveSnapshot;
  readonly onAdd: (kind: QuickAddKind) => void;
  readonly addDisabled: boolean;
  readonly disabledQuickAddKinds?: ReadonlySet<QuickAddKind> | undefined;
  readonly onSubmit: () => void;
  readonly submitDisabled: boolean;
  readonly submitDisabledReason?: string | undefined;
}

interface LeadCompletionActionsProps extends LeadCompletionActionContract {
  readonly label: string;
  readonly compact?: boolean | undefined;
}

export function LeadCompletionActions({
  autosave,
  onAdd,
  addDisabled,
  disabledQuickAddKinds,
  onSubmit,
  submitDisabled,
  submitDisabledReason,
  label,
  compact = false,
}: LeadCompletionActionsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap items-center justify-end gap-2 [&_button]:min-h-10 ${
        compact
          ? "max-sm:w-full max-sm:justify-stretch max-sm:[&_button]:flex-1 max-md:[&_button]:min-h-[var(--touch-target-min)] max-md:[&_button]:min-w-[var(--touch-target-min)]"
          : ""
      }`}
    >
      <SaveNowButton autosave={autosave} />
      <QuickAddButton
        onPick={onAdd}
        disabled={addDisabled}
        disabledKinds={disabledQuickAddKinds}
        placement={compact ? "above" : "below"}
      />
      <button
        type="button"
        className="btn-press inline-flex h-[var(--toolbar-control-h)] min-h-10 items-center justify-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onSubmit}
        disabled={submitDisabled}
        title={submitDisabledReason}
      >
        Submit
      </button>
    </div>
  );
}

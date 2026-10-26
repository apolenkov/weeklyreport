"use client";

import {
  type LeadCompletionActionContract,
  LeadCompletionActions,
} from "./lead-completion-actions";

interface LeadStickyCompletionActionsProps {
  readonly actions: LeadCompletionActionContract;
}

export function LeadStickyCompletionActions({
  actions,
}: LeadStickyCompletionActionsProps) {
  return (
    <aside
      aria-label="Report completion"
      className="relative z-20 mx-auto w-full max-w-3xl rounded-t-[var(--radius)] border border-b-0 border-[var(--color-border)] bg-[var(--color-card)] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg"
      data-testid="lead-sticky-completion-actions"
    >
      <LeadCompletionActions
        {...actions}
        label="Sticky completion actions"
        compact
      />
    </aside>
  );
}

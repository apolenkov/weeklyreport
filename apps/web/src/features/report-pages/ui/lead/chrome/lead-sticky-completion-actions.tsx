"use client";

import {
  type LeadCompletionActionContract,
  LeadCompletionActions,
} from "./lead-completion-actions";

// Bottom padding that keeps the last content clear of the fixed cluster.
export const LEAD_STICKY_COMPLETION_CLEARANCE_CLASS =
  "pb-[var(--lead-sticky-completion-clearance)]";

interface LeadStickyCompletionActionsProps {
  readonly actions: LeadCompletionActionContract;
}

export function LeadStickyCompletionActions({
  actions,
}: LeadStickyCompletionActionsProps) {
  return (
    <aside
      aria-label="Report completion"
      className="fixed inset-x-3 bottom-0 z-[var(--layer-popover)] mx-auto max-w-3xl rounded-t-[var(--radius)] border border-b-0 border-[var(--color-border)] bg-[var(--toolbar-band-gradient)] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl backdrop-blur-sm"
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

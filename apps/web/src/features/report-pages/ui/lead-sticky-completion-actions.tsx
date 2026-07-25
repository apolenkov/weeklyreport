"use client";

import { autosaveStatusCopy } from "./autosave-state-copy";
import {
  type LeadCompletionActionContract,
  LeadCompletionActions,
} from "./lead-completion-actions";

interface LeadStickyCompletionActionsProps {
  readonly actions: LeadCompletionActionContract;
}

/**
 * Lead Sticky Completion Actions.
 * @param props - The props argument.
 */
export function LeadStickyCompletionActions({
  actions,
}: LeadStickyCompletionActionsProps) {
  const saveState = autosaveStatusCopy(actions.autosave.state);
  return (
    <aside
      aria-label="Report completion"
      className="fixed inset-x-3 bottom-0 z-50 mx-auto max-w-3xl rounded-t-[var(--radius)] border border-b-0 border-[var(--color-border)] bg-white/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl backdrop-blur-sm"
      data-testid="lead-sticky-completion-actions"
    >
      <span className="sr-only" role="status">
        {saveState}
      </span>
      <LeadCompletionActions
        {...actions}
        label="Sticky completion actions"
        compact
      />
    </aside>
  );
}

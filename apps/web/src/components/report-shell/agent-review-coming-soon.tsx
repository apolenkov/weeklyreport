import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { BotMessageSquare } from "lucide-react";

import { COMING_SOON_TOOLTIP_ANCHOR } from "../coming-soon-tooltip-anchor";

/**
 * Inert placeholder for the future agent-review surface.
 * TODO(AGENT-REVIEW-01): mount in lead+head slide and report surfaces
 *
 * compact — strips touch-target min-height for slides header where space is tight.
 */
export function AgentReviewComingSoon({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-disabled="true"
        aria-label="Agent review is coming soon"
        data-testid="agent-review-coming-soon"
        className={`inline-flex cursor-default items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] font-semibold text-[var(--color-muted-foreground)] ${
          compact
            ? "h-[var(--toolbar-control-h)] px-2.5 text-xs"
            : "min-h-[var(--touch-target-min)] px-4 py-1.5 text-sm"
        }`}
      >
        <BotMessageSquare size={14} strokeWidth={2} aria-hidden="true" />
        <span>Agent review</span>
      </button>
      <ComingSoonBadge role="tooltip" className={COMING_SOON_TOOLTIP_ANCHOR} />
    </div>
  );
}

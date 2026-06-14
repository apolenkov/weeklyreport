import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { BotMessageSquare } from "lucide-react";

/**
 * Inert placeholder for the future agent-review surface.
 * TODO(AGENT-REVIEW-01): mount in lead+head slide and report surfaces
 *
 * compact — tighter padding/text for dense rows, but the touch-target
 * min-height is preserved so the pill aligns 1:1 with its sibling controls
 * (lead-live-walk-2026-06-14 task 5.2: ONE shared height across the bar).
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
        title="Coming Soon"
        data-testid="agent-review-coming-soon"
        className={`inline-flex min-h-[var(--touch-target-min)] cursor-default items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] font-semibold text-[var(--color-muted-foreground)] ${
          compact ? "px-2.5 py-1 text-xs" : "px-4 py-1.5 text-sm"
        }`}
      >
        <BotMessageSquare size={14} strokeWidth={2} aria-hidden="true" />
        <span>Agent review</span>
      </button>
      <ComingSoonBadge
        role="tooltip"
        className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-30 opacity-0 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.08)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </div>
  );
}

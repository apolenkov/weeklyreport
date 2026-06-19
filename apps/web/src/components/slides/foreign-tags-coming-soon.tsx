import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { Tags } from "lucide-react";

/**
 * Inert placeholder acknowledging that per-author attribution of co-owners'
 * merged rows is deferred. In the Everyone slide deck, co-owners' items/risks/
 * decisions fold into the bullet grids as plain rows with no per-row "who owns
 * this" marker (ADR 0003: the slide grids are flat string[]). This tells the
 * lead the attribution is roadmapped rather than leaving a silent gap.
 *
 * close-slides-visibility-tails (tail 2). Rendered only on the lead's OWN deck,
 * in Everyone, in the own-scope bullet view, and NOT during fullscreen
 * presentation — it is a working-view hint, not part of the projected deck.
 * TODO(SLIDE-FOREIGN-TAGS-01): restructure the flat string[] slide grids into
 * attributed row objects and render real per-author tags.
 */
export function ForeignTagsComingSoon() {
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-disabled="true"
        aria-label="Per-author row tags are coming soon"
        title="Coming Soon"
        data-testid="foreign-tags-coming-soon"
        className="inline-flex h-[var(--toolbar-control-h)] cursor-default items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-2.5 text-xs font-semibold text-[var(--color-muted-foreground)]"
      >
        <Tags size={14} strokeWidth={2} aria-hidden="true" />
        <span>Author tags</span>
      </button>
      <ComingSoonBadge
        role="tooltip"
        className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-30 opacity-0 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.08)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </div>
  );
}

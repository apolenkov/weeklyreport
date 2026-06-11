import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { History } from "lucide-react";

/**
 * Inert toolbar control marking the removed version-history feature as
 * deferred (deferred-feature-pattern; reference:
 * `LanguageComingSoonControl` in `../navigation/nav-bar.tsx`).
 */
export function VersionComingSoonControl() {
  // TODO(versions-v2): replace this inert control with the real version
  // history UI when versioning returns (see the versions-v2 research draft).
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-disabled="true"
        aria-label="Version history is coming soon"
        title="Coming Soon"
        data-testid="version-coming-soon"
        className="inline-flex h-8 w-10 cursor-default items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-0 text-[12px] font-semibold text-[var(--color-muted-foreground)]"
      >
        <History size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <ComingSoonBadge
        role="tooltip"
        className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-30 opacity-0 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.08)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </div>
  );
}

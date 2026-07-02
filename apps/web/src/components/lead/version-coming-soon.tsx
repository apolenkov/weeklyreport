import { ComingSoonTooltip } from "@customreport/ui/components/ui/tooltip";
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
    <ComingSoonTooltip>
      <button
        type="button"
        aria-disabled="true"
        aria-label="Version history is coming soon"
        data-testid="version-coming-soon"
        className="inline-flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] shrink-0 cursor-default items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-empty)] text-[12px] font-semibold text-[var(--color-muted-foreground)]"
      >
        <History size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </ComingSoonTooltip>
  );
}

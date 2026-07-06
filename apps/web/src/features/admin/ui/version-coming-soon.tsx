import { ComingSoonIconButton } from "@customreport/ui/components/coming-soon-control";
import { History } from "lucide-react";

/**
 * Inert toolbar control marking the removed version-history feature as
 * deferred (deferred-feature-pattern; reference:
 * `LanguageComingSoonControl` in `shared/ui/navigation/nav-bar.tsx`).
 */
export function VersionComingSoonControl() {
  // TODO(versions-v2): replace this inert control with the real version
  // history UI when versioning returns (see the versions-v2 research draft).
  return (
    <ComingSoonIconButton
      icon={History}
      shape="toolbar"
      ariaLabel="Version history is coming soon"
      testId="version-coming-soon"
    />
  );
}

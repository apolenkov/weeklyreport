import { ChevronDown } from "lucide-react";

/**
 * Shared accordion/expandable chevron (web-shared-idioms): lucide's
 * `ChevronDown` rotated by expand state — collapsed points right (-90deg),
 * expanded points down (0deg). Homes the three hand-rolled rotating SVGs so the
 * transition and the single `aria-hidden` live in one place. The static
 * split-button glyph is intentionally NOT routed through here (it must not
 * rotate or resize).
 */
export function RotatingChevron({ expanded }: { readonly expanded: boolean }) {
  return (
    <ChevronDown
      aria-hidden="true"
      className="h-4 w-4 text-[var(--color-muted-foreground)] transition-transform duration-300"
      style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
    />
  );
}

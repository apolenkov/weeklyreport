import { ChevronDown } from "lucide-react";

// Shared rotating chevron keeps accordion direction, transition, and aria-hidden
// behavior in one place; static split-button glyphs stay separate.
export function RotatingChevron({ expanded }: { readonly expanded: boolean }) {
  return (
    <ChevronDown
      aria-hidden="true"
      className="h-4 w-4 text-[var(--color-muted-foreground)] transition-transform duration-300 motion-reduce:transition-none"
      style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
    />
  );
}

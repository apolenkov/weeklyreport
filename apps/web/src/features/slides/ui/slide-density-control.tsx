import type { SlideDensity } from "../model/slide-density-pagination";

const DENSITIES: readonly {
  readonly value: SlideDensity;
  readonly label: string;
}[] = [
  { value: "document", label: "Document" },
  { value: "presentation", label: "Presentation" },
];

export function SlideDensityControl({
  value,
  onChange,
}: {
  readonly value: SlideDensity;
  readonly onChange: (density: SlideDensity) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {/* Muted caption nests this second segmented group in the toolbar —
          next to the view-mode pill it otherwise reads as a peer toggle. */}
      <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
        Format
      </span>
      <div
        role="group"
        aria-label="Slide density"
        className="inline-flex rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] p-1"
      >
        {DENSITIES.map((density) => {
          const active = density.value === value;
          return (
            <button
              key={density.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(density.value)}
              className={`inline-flex h-[var(--toolbar-control-h)] items-center justify-center rounded-[var(--radius-pill)] px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 ${
                active
                  ? "bg-[var(--color-toggle-active)] text-[var(--color-primary-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {density.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

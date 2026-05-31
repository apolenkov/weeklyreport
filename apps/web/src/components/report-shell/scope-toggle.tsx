"use client";

export type ScopeValue = "own" | "product" | "lead";

interface ScopeToggleProps {
  value: ScopeValue;
  onChange: (next: ScopeValue) => void;
  allowedScopes?: ReadonlyArray<ScopeValue>;
}

const DEFAULT_SCOPES: ReadonlyArray<ScopeValue> = [
  "own",
  "product",
  "lead",
] as const;

const LABELS: Record<ScopeValue, string> = {
  own: "Own",
  product: "By product",
  lead: "By lead",
};

export function ScopeToggle({
  value,
  onChange,
  allowedScopes = DEFAULT_SCOPES,
}: ScopeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Slide scope"
      className="inline-flex h-7 items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.15)] bg-[var(--color-surface)] p-0.5"
    >
      {allowedScopes.map((s) => {
        return (
          // biome-ignore lint/a11y/useSemanticElements: <input type="radio"> would require label/name wiring that changes layout; <button role="radio"> is valid per ARIA spec
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            onClick={() => onChange(s)}
            className={`rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition-colors ${
              value === s
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

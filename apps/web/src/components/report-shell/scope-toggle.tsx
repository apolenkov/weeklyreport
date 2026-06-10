"use client";

export type ScopeValue = "own" | "product" | "lead";

interface ScopeToggleProps {
  value: ScopeValue;
  onChange: (next: ScopeValue) => void;
  allowedScopes?: readonly ScopeValue[];
}

const DEFAULT_SCOPES: readonly ScopeValue[] = [
  "own",
  "product",
  "lead",
] as const;

const LABELS: Record<ScopeValue, string> = {
  own: "Own",
  product: "Product",
  lead: "Leads",
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
      className="inline-flex min-h-[var(--touch-target-min)] items-stretch rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.15)] bg-[var(--color-surface)] p-0.5"
    >
      {allowedScopes.map((s) => {
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            onClick={() => onChange(s)}
            className={`inline-flex items-center rounded-[var(--radius-pill)] px-3 py-1 text-sm font-semibold transition-colors ${
              value === s
                ? "bg-[var(--color-starbucks-accent)] text-white"
                : "text-[var(--color-starbucks-accent)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

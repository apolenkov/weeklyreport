"use client";

type Props = {
  readonly scope: "own" | "product";
  readonly onChange: (scope: "own" | "product") => void;
};

export function LeadScopeToggle({ scope, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Slide scope"
      className="inline-flex rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.15)] bg-[var(--color-surface)] p-0.5"
    >
      {(["own", "product"] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={scope === s}
          onClick={() => onChange(s)}
          className={`rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition-colors ${
            scope === s
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          }`}
        >
          {s === "own" ? "Own" : "By product"}
        </button>
      ))}
    </div>
  );
}

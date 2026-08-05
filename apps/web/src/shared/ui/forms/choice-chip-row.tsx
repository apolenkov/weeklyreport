"use client";

export interface ChipChoice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly bg: string;
  readonly color: string;
  readonly border: string;
}

interface ChoiceChipRowProps<T extends string> {
  readonly choices: readonly ChipChoice<T>[];
  readonly value: T;
  readonly onSelect: (value: T) => void;
}

const CHIP_IDLE_BORDER = "var(--color-border-strong)";

export function ChoiceChipRow<T extends string>({
  choices,
  value,
  onSelect,
}: ChoiceChipRowProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onSelect(c.value)}
            className="inline-flex min-h-[var(--touch-target-min)] md:min-h-[34px] items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition-[background-color,border-color,color,opacity]"
            style={{
              background: selected ? c.bg : "transparent",
              color: selected ? c.color : "var(--color-foreground)",
              border: `1.5px solid ${selected ? c.border : CHIP_IDLE_BORDER}`,
            }}
            aria-pressed={selected}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

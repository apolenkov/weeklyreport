"use client";

import type { LucideIcon } from "lucide-react";

export interface ChipChoice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly bg: string;
  readonly color: string;
  readonly border: string;
}

interface ChoiceChipRowProps<T extends string> {
  readonly choices: readonly ChipChoice<T>[];
  readonly value: T;
  readonly onSelect: (value: T) => void;
  readonly ariaLabelledBy?: string | undefined;
}

const CHIP_IDLE_BORDER = "var(--color-border-strong)";

export function ChoiceChipRow<T extends string>({
  choices,
  value,
  onSelect,
  ariaLabelledBy,
}: ChoiceChipRowProps<T>) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      {...(ariaLabelledBy
        ? { "aria-labelledby": ariaLabelledBy }
        : { "aria-label": "Options" })}
    >
      {choices.map(({ icon: Icon, ...c }) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onSelect(c.value)}
            className="inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition-[background-color,border-color,color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] motion-reduce:transition-none"
            style={{
              background: selected ? c.bg : "transparent",
              color: selected ? c.color : "var(--color-foreground)",
              border: `1.5px solid ${selected ? c.border : CHIP_IDLE_BORDER}`,
            }}
            aria-pressed={selected}
          >
            {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

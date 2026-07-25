"use client";

import { useRef } from "react";

import { segmentClassName, SegmentedToggle } from "./segmented-toggle";

export type ScopeValue = "own" | "product" | "lead";

// Generic over the allowed subset so a product/lead-only surface can pass its
// narrowed setter. allowedScopes is REQUIRED: a defaulted full list could feed
// "own" into a narrowed onChange.
interface ScopeToggleProps<T extends ScopeValue> {
  value: T;
  onChange: (next: T) => void;
  allowedScopes: readonly T[];
  size?: "sm" | "lg";
}

// Slide layout "own" is labeled "Summary" so it is not confused with the
// toolbar's Mine/Everyone record-visibility scope. Value stays "own".
const LABELS: Record<ScopeValue, string> = {
  own: "Summary",
  product: "Product",
  lead: "Leads",
};

export function ScopeToggle<T extends ScopeValue>({
  value,
  onChange,
  allowedScopes,
  size = "sm",
}: ScopeToggleProps<T>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // WAI-ARIA radiogroup keyboard model: arrow keys move focus to the adjacent
  // radio AND select it (wrapping at the ends). Roving tabindex keeps only the
  // checked radio in the tab order.
  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void {
    const isNext = event.key === "ArrowRight" || event.key === "ArrowDown";
    const isPrev = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!isNext && !isPrev) return;

    event.preventDefault();
    const delta = isNext ? 1 : -1;
    const nextIndex =
      (index + delta + allowedScopes.length) % allowedScopes.length;
    const nextScope = allowedScopes[nextIndex];
    if (nextScope === undefined) return;
    onChange(nextScope);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <SegmentedToggle role="radiogroup" ariaLabel="Slide scope" size={size}>
      {allowedScopes.map((s, index) => (
        <button
          key={s}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === s}
          tabIndex={value === s ? 0 : -1}
          onClick={() => onChange(s)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={segmentClassName(value === s)}
        >
          {LABELS[s]}
        </button>
      ))}
    </SegmentedToggle>
  );
}

"use client";

import { useRef } from "react";

import { segmentClassName, SegmentedToggle } from "./segmented-toggle";

export type ScopeValue = "own" | "product" | "lead";

interface ScopeToggleProps {
  value: ScopeValue;
  onChange: (next: ScopeValue) => void;
  allowedScopes?: readonly ScopeValue[];
  /** "sm" = toolbar (default); "lg" = slide-hero row height. */
  size?: "sm" | "lg";
}

const DEFAULT_SCOPES: readonly ScopeValue[] = [
  "own",
  "product",
  "lead",
] as const;

// slides-record-visibility (Decision 2): the slide layout scope "own" is
// labeled "Summary" (section-summary vs per-product grid) so it does not read
// as the Mine/Everyone RECORD-visibility scope, which lives in the toolbar. The
// value/key stays "own"; only the label changes. The head deck reuses this with
// ["lead","product"] and is unaffected.
const LABELS: Record<ScopeValue, string> = {
  own: "Summary",
  product: "Product",
  lead: "Leads",
};

// Neutral segmented-toggle family via the shared primitive (same chrome as
// ViewModeToggle and RecordVisibilityToggle). The segment count is variable
// (2 or 3, driven by allowedScopes); the track owns the pill shape so no
// index-aware edge rounding is needed.
export function ScopeToggle({
  value,
  onChange,
  allowedScopes = DEFAULT_SCOPES,
  size = "sm",
}: ScopeToggleProps) {
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

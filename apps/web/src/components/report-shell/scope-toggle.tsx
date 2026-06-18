"use client";

import { segmentClassName, SegmentedToggle } from "./segmented-toggle";

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

// Neutral segmented-toggle family via the shared primitive (same chrome as
// ViewModeToggle and RecordVisibilityToggle). The segment count is variable
// (2 or 3, driven by allowedScopes); the track owns the pill shape so no
// index-aware edge rounding is needed.
export function ScopeToggle({
  value,
  onChange,
  allowedScopes = DEFAULT_SCOPES,
}: ScopeToggleProps) {
  return (
    <SegmentedToggle role="radiogroup" ariaLabel="Slide scope">
      {allowedScopes.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={segmentClassName(value === s)}
        >
          {LABELS[s]}
        </button>
      ))}
    </SegmentedToggle>
  );
}

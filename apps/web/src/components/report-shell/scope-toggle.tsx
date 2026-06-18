"use client";

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
  return (
    <SegmentedToggle role="radiogroup" ariaLabel="Slide scope" size={size}>
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

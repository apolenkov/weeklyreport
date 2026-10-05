"use client";

import { User, Users } from "lucide-react";

import {
  segmentClassName,
  SegmentedToggle,
} from "../../../../../../shared/ui/report-shell/segmented-toggle";
import type { RecordVisibility } from "../../../../../report-sections/client";

const RECORD_VISIBILITY_OPTIONS = [
  { key: "mine", label: "Mine only", Icon: User },
  { key: "everyone", label: "Everyone", Icon: Users },
] as const satisfies readonly {
  readonly key: RecordVisibility;
  readonly label: string;
  readonly Icon: typeof User;
}[];

// SegmentedToggle's track padding leaves icon-only segments at 40px on mobile;
// floor both actionable segments at the shared touch target below `md`.
const MOBILE_TOUCH_SEGMENT_CLASS =
  "max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)]";

// View-only: changes what the lead sees, never what is submitted/published.
export function RecordVisibilityToggle({
  value,
  onChange,
  disabled = false,
  desktopLabels = false,
}: {
  readonly value: RecordVisibility;
  readonly onChange: (next: RecordVisibility) => void;
  // Foreign slide decks force Mine so co-owner rows never merge onto another deck.
  readonly disabled?: boolean;
  // Icon-only on narrow screens; desktopLabels restores "Mine only"/"Everyone"
  // at lg so the toggle reads as a segmented control, not a filled button.
  readonly desktopLabels?: boolean;
}) {
  const labelClassName = desktopLabels ? "sr-only lg:not-sr-only" : "sr-only";
  return (
    <SegmentedToggle ariaLabel="Record visibility">
      {RECORD_VISIBILITY_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          aria-label={option.label}
          title={option.label}
          disabled={disabled}
          onClick={() => onChange(option.key)}
          className={`btn-press ${segmentClassName(value === option.key, {
            iconOnly: true,
            desktopLabels,
          })} ${MOBILE_TOUCH_SEGMENT_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option.Icon className="h-4 w-4" aria-hidden="true" />
          <span className={labelClassName}>{option.label}</span>
        </button>
      ))}
    </SegmentedToggle>
  );
}

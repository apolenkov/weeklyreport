"use client";

import { User, Users } from "lucide-react";

import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import {
  segmentClassName,
  SegmentedToggle,
} from "../../../shared/ui/report-shell/segmented-toggle";

const RECORD_VISIBILITY_OPTIONS = [
  { key: "mine", label: "Mine only", Icon: User },
  { key: "everyone", label: "Everyone", Icon: Users },
] as const satisfies readonly {
  readonly key: RecordVisibility;
  readonly label: string;
  readonly Icon: typeof User;
}[];

// View-only: changes what the lead sees, never what is submitted/published.
export function RecordVisibilityToggle({
  value,
  onChange,
  disabled = false,
}: {
  readonly value: RecordVisibility;
  readonly onChange: (next: RecordVisibility) => void;
  // Foreign slide decks force Mine so co-owner rows never merge onto another deck.
  readonly disabled?: boolean;
}) {
  // Icon-only (User = mine, Users = everyone) so the toggle stays compact and
  // does not crowd the period navigator; each keeps an accessible name via
  // aria-label + tooltip.
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
          })} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option.Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </SegmentedToggle>
  );
}

"use client";

import { User, Users } from "lucide-react";

import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import {
  segmentClassName,
  SegmentedToggle,
} from "../../../shared/ui/report-shell/segmented-toggle";

/**
 * The lead form's Record visibility toggle. A two-state segmented control —
 * "Mine only" (default) / "Everyone". Lead-form only; view-only (it changes
 * what the lead sees, never what is submitted or published). English label
 * per the repo UI-string rule.
 */
export function RecordVisibilityToggle({
  value,
  onChange,
  disabled = false,
}: {
  readonly value: RecordVisibility;
  readonly onChange: (next: RecordVisibility) => void;
  /**
   * On a FOREIGN-author slide deck Everyone is not offered — the toggle is
   * forced to Mine and made inert so the current user's co-owner rows can
   * never be merged onto another author's deck.
   */
  readonly disabled?: boolean;
}) {
  // Icon-only (User = mine, Users = everyone) so the toggle stays compact and
  // does not crowd the period navigator; each keeps an accessible name via
  // aria-label + tooltip.
  const options: {
    key: RecordVisibility;
    label: string;
    Icon: typeof User;
  }[] = [
    { key: "mine", label: "Mine only", Icon: User },
    { key: "everyone", label: "Everyone", Icon: Users },
  ];
  return (
    <SegmentedToggle ariaLabel="Record visibility">
      {options.map((option) => (
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

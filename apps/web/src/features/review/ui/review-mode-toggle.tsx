"use client";

import {
  segmentClassName,
  SegmentedToggle,
} from "../../../shared/ui/report-shell/segmented-toggle";

// "review" surfaces comment composers and section verdicts; offered only when
// the caller can review at least one section.
export type ReviewMode = "read" | "review";

const SEGMENTS: readonly { value: ReviewMode; label: string }[] = [
  { value: "read", label: "Read" },
  { value: "review", label: "Review" },
];

export function ReviewModeToggle({
  value,
  onChange,
}: {
  readonly value: ReviewMode;
  readonly onChange: (next: ReviewMode) => void;
}) {
  return (
    <SegmentedToggle ariaLabel="Report mode">
      {SEGMENTS.map((segment) => (
        <button
          key={segment.value}
          type="button"
          aria-pressed={value === segment.value}
          onClick={() => onChange(segment.value)}
          className={segmentClassName(value === segment.value)}
        >
          {segment.label}
        </button>
      ))}
    </SegmentedToggle>
  );
}

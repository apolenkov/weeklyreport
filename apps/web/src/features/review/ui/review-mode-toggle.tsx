"use client";

import {
  segmentClassName,
  SegmentedToggle,
} from "../../../shared/ui/report-shell/segmented-toggle";

/**
 * Report body mode. "read" renders the assembled report as read-only content;
 * "review" surfaces the per-record comment composer and per-section verdict
 * controls. Client-only, default "read", offered only to a caller who can
 * review at least one section.
 */
export type ReviewMode = "read" | "review";

const SEGMENTS: readonly { value: ReviewMode; label: string }[] = [
  { value: "read", label: "Read" },
  { value: "review", label: "Review" },
];

/** The [Read | Review] toggle, in the shared neutral segmented-toggle family. */
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

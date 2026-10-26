"use client";

import { SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";

import { RecordTextareaField } from "../../../shared/ui/forms/record-textarea-field";

// Two lines of text at the field's text-sm size without forcing a tall panel.
const PAUSED_REASON_MIN_HEIGHT_PX = 52;

// Parent blocks save while empty — reason is required for paused items.
export function PausedReasonField({
  value,
  error,
  onChange,
}: {
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (next: string) => void;
}) {
  // Save persists the trimmed draft and validates that same value, so the
  // counter must ignore surrounding whitespace instead of counting the draft.
  const savedCharacterCount = Array.from(value.trim()).length;
  return (
    <RecordTextareaField
      id="item-paused-reason"
      label="Pause reason"
      required
      value={value}
      onChange={onChange}
      error={error}
      placeholder="Why is this paused? (e.g. waiting on a dependency)"
      minHeightPx={PAUSED_REASON_MIN_HEIGHT_PX}
      characterLimit={SAFE_TEXT_MAX_LENGTH}
      characterCount={savedCharacterCount}
      fill={false}
    />
  );
}

import {
  INVISIBLE_TEXT_MESSAGE,
  NULL_BYTES_MESSAGE,
  SAFE_TEXT_MAX_LENGTH,
  safeText,
} from "@weeklyreport/shared";

/** Required pause reason copy shared by every pause prompt. */
export const PAUSE_REASON_REQUIRED_MESSAGE =
  "A reason is required to pause an item.";

// Mirrors the server's `pausedReason: safeText()` write rule (section-record
// schema) on the trimmed value the client persists, so a prompt never hands the
// autosave a reason the server would reject and drop the whole draft row.
export function getPauseReasonError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return PAUSE_REASON_REQUIRED_MESSAGE;
  const result = safeText().safeParse(trimmed);
  if (result.success) return undefined;
  if (result.error.issues.some((issue) => issue.code === "too_big")) {
    return `Pause reason must be ${SAFE_TEXT_MAX_LENGTH} characters or fewer.`;
  }
  if (
    result.error.issues.some((issue) => issue.message === NULL_BYTES_MESSAGE)
  ) {
    return NULL_BYTES_MESSAGE;
  }
  return INVISIBLE_TEXT_MESSAGE;
}

import type { RecordOmissionSummary } from "@weeklyreport/shared";

import { recordOmissionNoticeText } from "../../lib/format/record-omission-text";

/** The notice sits apart from the pending-section count and the status alarms. */
export function RecordOmissionNotice({
  summary,
}: {
  readonly summary: RecordOmissionSummary;
}) {
  const text = recordOmissionNoticeText(summary);
  if (text === null) return null;
  return (
    <p
      role="note"
      aria-label="Records not shown"
      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-foreground)]"
    >
      {text}
    </p>
  );
}

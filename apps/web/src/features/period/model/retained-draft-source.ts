import type { RetainedReadOnlyReason } from "@weeklyreport/shared";

const READ_ONLY_REASON: Record<RetainedReadOnlyReason, string> = {
  published:
    "This report is published and can no longer be edited, so these drafts are read-only.",
  archived: "This report is archived, so these drafts are read-only.",
  "not-current":
    "This report is no longer your current one, so these drafts are read-only.",
  reopened:
    "This report was reopened. Finish these drafts in the report form; here they are read-only.",
};

export function retainedDraftSourceReason(
  reason: RetainedReadOnlyReason,
): string {
  return READ_ONLY_REASON[reason];
}

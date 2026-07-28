import type {
  RecordCommentView,
  ReportSectionReadModel,
} from "@customreport/shared";

import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";

// One of the lead's own records with reviewer comments. `text` is the record's
// own text (context for the lead) — never re-rendered as a comment.
export interface LeadReviewFeedbackRecord {
  readonly id: string;
  readonly kind: "item" | "risk" | "decision";
  readonly productName: string;
  readonly text: string;
  readonly comments: readonly RecordCommentView[];
}

// Drop records with zero comments; shared by the three mapLeadReviewFeedback branches.
function toFeedbackRecords<
  T extends {
    id?: string | null | undefined;
    comments?: readonly RecordCommentView[] | undefined;
  },
>(
  records: readonly T[],
  kind: LeadReviewFeedbackRecord["kind"],
  textOf: (record: T) => string,
  labelOf: (record: T) => string,
): LeadReviewFeedbackRecord[] {
  return records
    .filter((record) => (record.comments?.length ?? 0) > 0)
    .map((record) => ({
      id: record.id ?? "",
      kind,
      productName: labelOf(record),
      text: textOf(record),
      comments: record.comments ?? [],
    }));
}

// Collect item/risk/decision rows that carry ≥1 reviewer comment for the feedback panel.
export function mapLeadReviewFeedback(
  section: ReportSectionReadModel,
): LeadReviewFeedbackRecord[] {
  const projectIndex = buildProjectIndex(section);
  // Activity-parented records have null projectId — resolve label from activities.
  // Product name wins when present (XOR parent), else activity name, else "Unknown".
  const activityIndex = buildActivityIndex(section);
  const labelFor = (
    projectId: string | null | undefined,
    activityId: string | null | undefined,
  ): string => {
    if (projectId) return projectIndex.get(projectId)?.name ?? "Unknown";
    if (activityId) return activityIndex.get(activityId) ?? "Unknown";
    return "Unknown";
  };

  return [
    ...toFeedbackRecords(
      section.items,
      "item",
      (item) => item.text,
      (item) => labelFor(item.projectId, item.activityId),
    ),
    ...toFeedbackRecords(
      section.risks,
      "risk",
      (risk) => risk.risk,
      (risk) => labelFor(risk.projectId, risk.activityId),
    ),
    ...toFeedbackRecords(
      section.decisions,
      "decision",
      (decision) => decision.text,
      (decision) =>
        labelFor(decision.productId ?? undefined, decision.activityId),
    ),
  ];
}

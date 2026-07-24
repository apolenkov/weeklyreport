import type {
  RecordCommentView,
  ReportSectionReadModel,
} from "@customreport/shared";

import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";

/**
 * review-acknowledgement: one of the lead's OWN records that carries
 * reviewer comments. Surfaced read-only when a returned (draft) section comes
 * back, so the feedback is not silent. `text` is the record's OWN text — context
 * for the lead, NEVER re-rendered as a comment.
 */
export interface LeadReviewFeedbackRecord {
  readonly id: string;
  readonly kind: "item" | "risk" | "decision";
  readonly productName: string;
  readonly text: string;
  readonly comments: readonly RecordCommentView[];
}

/**
 * Reshape one record collection (items / risks / decisions) into feedback
 * rows: records with zero reviewer comments are dropped, the rest carry an
 * id-fallback of `""` and the caller-resolved kind/text/label. Shared by the
 * three `mapLeadReviewFeedback` branches below so they differ only in which
 * fields feed `textOf` / `labelOf`.
 */
function toFeedbackRecords<
  T extends { id?: string | null; comments?: readonly RecordCommentView[] },
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

/**
 * Collect every item/risk/decision on the section that carries ≥1 reviewer
 * comment, keyed to the record's own text + resolved product name. Records with
 * no comments are dropped (nothing to surface). The comment payload rides the
 * read model (the repo joins `RecordComment` into the section read); this mapper
 * only reshapes it for the lead's feedback panel.
 */
export function mapLeadReviewFeedback(
  section: ReportSectionReadModel,
): LeadReviewFeedbackRecord[] {
  const projectIndex = buildProjectIndex(section);
  // activity-first-class: an activity-parented record has a null projectId, so
  // resolve its label from the section's activities instead of falling through
  // to "Unknown". The product name wins when present (XOR — a record parents to
  // exactly one), else the activity name, else "Unknown" for orphaned legacy.
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

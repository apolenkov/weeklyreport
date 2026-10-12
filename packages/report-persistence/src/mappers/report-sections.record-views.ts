import {
  type ItemOutcomeEvent,
  itemOutcomeEventSchema,
  itemResolutionSchema,
} from "@weeklyreport/shared";

import type {
  PrismaReportSectionWithRelations as SectionRow,
  RecordCommentRow,
  SectionReviewRow,
} from "../report-sections.include.js";

const toCommentViews = (comments: readonly RecordCommentRow[]) =>
  comments.map((comment) => ({
    id: comment.id,
    reviewerId: comment.reviewerId,
    reviewerName: comment.reviewer.name,
    text: comment.text,
    createdAt: comment.createdAt,
  }));

export const toReviewViews = (
  reviews: readonly SectionReviewRow[],
  version: number,
) =>
  reviews.map((review) => ({
    reviewerId: review.reviewerId,
    reviewerName: review.reviewer.name,
    verdict: review.verdict === "approved" ? "approved" : "changes_requested",
    judgedVersion: review.judgedVersion,
    ...(review.comment ? { comment: review.comment } : {}),
    isCurrent: review.judgedVersion === version,
    createdAt: review.createdAt,
  }));

export const toItemViews = (
  items: SectionRow["items"],
  events: SectionRow["itemOutcomeEvents"],
) => {
  const history = new Map<string, ItemOutcomeEvent[]>();
  for (const event of events) {
    const entry = itemOutcomeEventSchema.parse({
      id: event.id,
      stableId: event.stableId,
      outcome: event.outcome,
      reason: event.reason,
      actorId: event.actorId,
      actorName: event.actorName,
      occurredAt: event.occurredAt.toISOString(),
      beforeState: event.beforeState,
      afterState: event.afterState,
      reversesEventId: event.reversesEventId,
    });
    const entries = history.get(event.stableId) ?? [];
    entries.push(entry);
    history.set(event.stableId, entries);
  }
  return items.map((item) => ({
    id: item.id,
    stableId: item.stableId,
    projectId: item.projectId,
    activityId: item.activityId,
    type: item.type,
    text: item.text,
    tag: item.tag,
    workflowStatus: item.workflowStatus,
    carriedOver: item.carriedOver,
    priorityRank: item.priorityRank ?? null,
    pausedReason: item.pausedReason ?? null,
    nextStepText: item.nextStepText ?? null,
    resolution:
      item.resolution == null
        ? null
        : itemResolutionSchema.parse(item.resolution),
    outcomeHistory: history.get(item.stableId) ?? [],
    stageNames: item.stageNames,
    comments: toCommentViews(item.recordComments),
  }));
};

export const toRiskViews = (risks: SectionRow["risks"]) =>
  risks.map((risk) => ({
    id: risk.id,
    stableId: risk.stableId,
    projectId: risk.projectId,
    activityId: risk.activityId,
    risk: risk.risk,
    impact: risk.impact,
    mitigation: risk.mitigation,
    severity: risk.severity,
    stageNames: risk.stageNames,
    comments: toCommentViews(risk.recordComments),
  }));

export const toDecisionViews = (decisions: SectionRow["decisions"]) =>
  decisions.map((decision) => ({
    id: decision.id,
    stableId: decision.stableId,
    text: decision.text,
    owner: decision.owner,
    deadline: decision.deadline,
    impact: decision.impact,
    resolvedAt: decision.resolvedAt,
    stageNames: decision.stageNames,
    productId: decision.productId ?? undefined,
    activityId: decision.activityId ?? undefined,
    comments: toCommentViews(decision.recordComments),
  }));

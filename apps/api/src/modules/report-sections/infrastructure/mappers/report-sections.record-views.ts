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
    isCurrent: review.judgedVersion === version,
    createdAt: review.createdAt,
  }));

export const toItemViews = (items: SectionRow["items"]) =>
  items.map((item) => ({
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
    stageNames: item.stageNames.length > 0 ? item.stageNames : undefined,
    comments: toCommentViews(item.recordComments),
  }));

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
    stageNames: risk.stageNames.length > 0 ? risk.stageNames : undefined,
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
    stageNames:
      decision.stageNames.length > 0 ? decision.stageNames : undefined,
    productId: decision.productId ?? undefined,
    activityId: decision.activityId ?? undefined,
    comments: toCommentViews(decision.recordComments),
  }));

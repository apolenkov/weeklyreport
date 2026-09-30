import {
  type ReportSectionReadModel,
  type Role,
  type SharedReportSectionReadModel,
  sharedReportSectionReadModelSchema,
} from "@customreport/shared";

import {
  LeadFormAccessError,
  LeadFormDomainError,
  type LeadFormRepository,
  type ReopenEligibilityFacts,
} from "./lead-form-shared";

export interface ByPeriodRequest {
  readonly reportId: string;
  readonly userId: string;
  readonly role?: Role | undefined;
  readonly requestedAuthorId?: string | undefined;
}

// Lead-only shared-product scope; null for head/admin/own/no-access (see lead-form-cross-author-scope).
export async function resolveCrossAuthorScope(
  repository: LeadFormRepository,
  request: ByPeriodRequest,
): Promise<ReadonlySet<string> | null> {
  const { reportId, userId, role, requestedAuthorId } = request;
  if (
    role !== "lead" ||
    requestedAuthorId === undefined ||
    requestedAuthorId === userId
  ) {
    return null;
  }
  // Prove report access first: own a section in this report. Co-ownership
  // alone is report-wide and must not authorize reading a foreign section in
  // a report the caller does not belong to.
  const ownSection = await repository.getSectionForPeriod(reportId, userId);
  if (!ownSection) {
    return null;
  }
  const sharedProductIds = repository.getSharedNonArchivedProductIdsForReport
    ? await repository.getSharedNonArchivedProductIdsForReport(
        reportId,
        userId,
        requestedAuthorId,
      )
    : await repository.getSharedNonArchivedProductIds(
        userId,
        requestedAuthorId,
      );
  return sharedProductIds.length > 0 ? new Set(sharedProductIds) : null;
}

// Head single-group: reject cross-group target (fail closed). Admin never calls this.
export async function assertHeadTargetInGroup(
  repository: LeadFormRepository,
  headUserId: string,
  targetAuthorId: string,
): Promise<void> {
  const [headGroupId, targetGroupId] = await Promise.all([
    repository.getUserReportingGroupId(headUserId),
    repository.getUserReportingGroupId(targetAuthorId),
  ]);
  if (headGroupId === null || targetGroupId !== headGroupId) {
    throw new LeadFormAccessError(
      "Cannot read a section outside your reporting group.",
    );
  }
}

// Head cross-read uses atomic group-scoped query (no race with group reassignment).
// See openspec/specs/lead-form-cross-author-scope.
export async function readSectionForByPeriod(
  repository: LeadFormRepository,
  request: ByPeriodRequest,
  sectionAuthorId: string,
  isHeadCrossRead: boolean,
): Promise<{
  section: ReportSectionReadModel;
  readOnly: boolean;
  reopenFacts: ReopenEligibilityFacts;
}> {
  const { reportId, userId } = request;
  const result = isHeadCrossRead
    ? await repository.getSectionForPeriodAsGroupPeer(
        reportId,
        sectionAuthorId,
        userId,
      )
    : await repository.getSectionForPeriod(reportId, sectionAuthorId);
  if (!result) {
    throw isHeadCrossRead
      ? new LeadFormAccessError(
          "Cannot read a section outside your reporting group.",
        )
      : new LeadFormDomainError(
          `No section found for user in report ${reportId}.`,
        );
  }
  return result;
}

// Filter to co-owned products; strip fields the Everyone lens omits (no leak ceiling).
// Null-product activity rows drop. See openspec/specs/lead-form-cross-author-scope.
export function filterSectionToSharedProducts(
  section: ReportSectionReadModel,
  sharedProductIds: ReadonlySet<string>,
): SharedReportSectionReadModel {
  const items = section.items
    .filter((i) => i.projectId != null && sharedProductIds.has(i.projectId))
    .map(stripItemAuthorPrivateFields);
  const risks = section.risks
    .filter((r) => r.projectId != null && sharedProductIds.has(r.projectId))
    .map(stripRecordComments);
  const decisions = section.decisions
    .filter((d) => d.productId != null && sharedProductIds.has(d.productId))
    .map(stripRecordComments);
  const projects = section.projects.filter((p) =>
    sharedProductIds.has(p.projectId),
  );
  const referencedIds = new Set<string>([
    ...items.flatMap((i) => (i.projectId != null ? [i.projectId] : [])),
    ...risks.flatMap((r) => (r.projectId != null ? [r.projectId] : [])),
    ...decisions.flatMap((d) => (d.productId != null ? [d.productId] : [])),
  ]);
  const referencedProjects = section.referencedProjects.filter((rp) =>
    referencedIds.has(rp.projectId),
  );
  // Strip the fields the Everyone lens omits before the spread carries them:
  // `reviews` is dropped as a rest sibling, `activities` is re-set to empty.
  const { activities, reviews, ...rest } = section;
  return sharedReportSectionReadModelSchema.parse({
    ...rest,
    items,
    risks,
    decisions,
    projects,
    referencedProjects,
    activities: [],
    reviews: [],
  });
}

// Comments stay with the author; co-lead lens omits them.
function stripRecordComments<T extends { comments?: unknown }>(
  row: T,
): Omit<T, "comments"> {
  const { comments, ...restOfRow } = row;
  return restOfRow;
}

// Author-only pause and outcome audit fields are absent from the Everyone lens.
function stripItemAuthorPrivateFields<
  T extends {
    comments?: unknown;
    pausedReason?: unknown;
    nextStepText?: unknown;
    resolution?: unknown;
    outcomeHistory?: unknown;
  },
>(
  row: T,
): Omit<
  T,
  "comments" | "pausedReason" | "nextStepText" | "resolution" | "outcomeHistory"
> {
  const {
    comments,
    pausedReason,
    nextStepText,
    resolution,
    outcomeHistory,
    ...restOfRow
  } = row;
  return restOfRow;
}

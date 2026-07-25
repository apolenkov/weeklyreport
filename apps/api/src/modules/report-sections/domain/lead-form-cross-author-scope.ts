import type { ReportSectionReadModel, Role } from "@customreport/shared";

import {
  LeadFormAccessError,
  LeadFormDomainError,
  type LeadFormRepository,
  type ReopenEligibilityFacts,
} from "./lead-form-shared";

// Lead-only shared-product scope; null for head/admin/own/no-access (see lead-form-cross-author-scope).
/**
 * Resolve Cross Author Scope.
 * @param repository - The repository argument.
 * @param reportId - The reportId argument.
 * @param userId - The userId argument.
 * @param role - The role argument.
 * @param requestedAuthorId - The requestedAuthorId argument.
 */
export async function resolveCrossAuthorScope(
  repository: LeadFormRepository,
  reportId: string,
  userId: string,
  role: Role | undefined,
  requestedAuthorId: string | undefined,
): Promise<ReadonlySet<string> | null> {
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
  const sharedProductIds = await repository.getSharedNonArchivedProductIds(
    userId,
    requestedAuthorId,
  );
  return sharedProductIds.length > 0 ? new Set(sharedProductIds) : null;
}

// Head single-group: reject cross-group target (fail closed). Admin never calls this.
/**
 * Assert Head Target In Group.
 * @param repository - The repository argument.
 * @param headUserId - The headUserId argument.
 * @param targetAuthorId - The targetAuthorId argument.
 */
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
/**
 * Read Section For By Period.
 * @param repository - The repository argument.
 * @param reportId - The reportId argument.
 * @param sectionAuthorId - The sectionAuthorId argument.
 * @param userId - The userId argument.
 * @param isHeadCrossRead - The isHeadCrossRead argument.
 */
export async function readSectionForByPeriod(
  repository: LeadFormRepository,
  reportId: string,
  sectionAuthorId: string,
  userId: string,
  isHeadCrossRead: boolean,
): Promise<{
  section: ReportSectionReadModel;
  readOnly: boolean;
  reopenFacts: ReopenEligibilityFacts;
}> {
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
/**
 * Filter Section To Shared Products.
 * @param section - The section argument.
 * @param sharedProductIds - The sharedProductIds argument.
 */
export function filterSectionToSharedProducts(
  section: ReportSectionReadModel,
  sharedProductIds: ReadonlySet<string>,
): ReportSectionReadModel {
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
  const referencedProjects = section.referencedProjects?.filter((rp) =>
    referencedIds.has(rp.projectId),
  );
  // Strip the fields the Everyone lens omits before the spread carries them:
  // `reviews` is dropped as a rest sibling, `activities` is re-set to empty.
  const { activities, reviews, ...rest } = section;
  return {
    ...rest,
    items,
    risks,
    decisions,
    projects,
    referencedProjects,
    activities: [],
  };
}

// Comments stay with the author; co-lead lens omits them.
function stripRecordComments<T extends { comments?: unknown }>(
  row: T,
): Omit<T, "comments"> {
  const { comments, ...restOfRow } = row;
  return restOfRow;
}

// pausedReason is author free text; Everyone lens omits it.
function stripItemAuthorPrivateFields<
  T extends { comments?: unknown; pausedReason?: unknown },
>(row: T): Omit<T, "comments" | "pausedReason"> {
  const { comments, pausedReason, ...restOfRow } = row;
  return restOfRow;
}

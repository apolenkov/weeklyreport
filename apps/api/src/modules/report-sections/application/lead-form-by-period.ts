import type { ReportSectionReadModel, Role } from "@customreport/shared";

import {
  assertHeadTargetInGroup,
  filterSectionToSharedProducts,
  readSectionForByPeriod,
  resolveCrossAuthorScope,
} from "../domain/lead-form-cross-author-scope";
import {
  computeReopenEligibility,
  type LeadFormRepository,
} from "../domain/lead-form-shared";

export interface GetByPeriodResult {
  section: ReportSectionReadModel;
  readOnly: boolean;
  canRequestReopen: boolean;
  reopenBlockedReason: string | null;
  /**
   * Resolve-not-delete: the section's published item/decision lineages, so
   * the form can mark locked records and hide Delete. Advisory for the UI
   * only — the save-path guard enforces the lock.
   */
  publishedLineage: {
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  };
}

/**
 * Read By Period.
 * @param repository - The repository argument.
 * @param reportId - The reportId argument.
 * @param userId - The userId argument.
 * @param role - The role argument.
 * @param requestedAuthorId - The requestedAuthorId argument.
 */
export async function readByPeriod(
  repository: LeadFormRepository,
  reportId: string,
  userId: string,
  role: Role | undefined,
  requestedAuthorId: string | undefined,
): Promise<GetByPeriodResult> {
  const { sharedScope, sectionAuthorId, isHeadCrossRead } =
    await resolveSectionAuthor(
      repository,
      reportId,
      userId,
      role,
      requestedAuthorId,
    );
  // The `assertHeadTargetInGroup` pre-check in `resolveSectionAuthor` is only
  // the fast defense-in-depth guard; `readSectionForByPeriod` is the actual
  // enforcement — its head-cross branch re-evaluates group membership in the
  // SAME query as the section load, closing the race the pre-check leaves open.
  const result = await readSectionForByPeriod(
    repository,
    reportId,
    sectionAuthorId,
    userId,
    isHeadCrossRead,
  );
  return buildByPeriodResult(
    repository,
    result,
    sharedScope,
    sectionAuthorId,
    userId,
  );
}

async function resolveSectionAuthor(
  repository: LeadFormRepository,
  reportId: string,
  userId: string,
  role: Role | undefined,
  requestedAuthorId: string | undefined,
): Promise<{
  sharedScope: Awaited<ReturnType<typeof resolveCrossAuthorScope>>;
  sectionAuthorId: string;
  isHeadCrossRead: boolean;
}> {
  const isHeadLike = role === "head" || role === "admin";
  // One shared non-archived set gates AND scopes the lead cross-author read
  // (null = not a granted cross-author read, including archived-only sharing
  // or no report access). The head branch is group-scoped just below; admin
  // is global by design.
  const sharedScope = await resolveCrossAuthorScope(
    repository,
    reportId,
    userId,
    role,
    requestedAuthorId,
  );
  // A head is a single-group role: it may read another author's section only
  // inside its own reporting group. `requestedAuthorId` reaches here from a
  // client URL param, so bound it before the target section is loaded. admin
  // is exempt (global). A head's own read and a lead's genuine cross-author
  // shared read never enter this branch.
  const isHeadCrossRead =
    role === "head" &&
    requestedAuthorId !== undefined &&
    requestedAuthorId !== userId;
  if (isHeadCrossRead) {
    await assertHeadTargetInGroup(repository, userId, requestedAuthorId);
  }
  const sectionAuthorId =
    requestedAuthorId !== undefined && (isHeadLike || sharedScope !== null)
      ? requestedAuthorId
      : userId;
  return { sharedScope, sectionAuthorId, isHeadCrossRead };
}

async function buildByPeriodResult(
  repository: LeadFormRepository,
  result: Awaited<ReturnType<typeof readSectionForByPeriod>>,
  sharedScope: Awaited<ReturnType<typeof resolveCrossAuthorScope>>,
  sectionAuthorId: string,
  userId: string,
): Promise<GetByPeriodResult> {
  // A lead cross-author read returns only the records on products the two
  // leads share; the own-section and head/admin reads return the full section.
  const section =
    sharedScope !== null
      ? filterSectionToSharedProducts(result.section, sharedScope)
      : result.section;

  // The lead-only Request-Reopen affordance uses the SAME
  // `computeReopenEligibility` as the write guard, so the button shows exactly
  // when `requestReopen` would succeed. A head/admin or cross-author viewer
  // never files a reopen request — it is false when the section is not the
  // caller's own. `reopenFacts` never leaves the API.
  const isOwnSection = sectionAuthorId === userId;
  const { canRequestReopen, reason } = computeReopenEligibility(
    result.reopenFacts,
  );

  // Computed over the (possibly product-filtered) section actually returned,
  // so a cross-author read never leaks lineage of records it does not show.
  const publishedLineage = await repository.getPublishedLineage(section);

  return {
    section,
    readOnly: result.readOnly || !isOwnSection,
    canRequestReopen: isOwnSection && canRequestReopen,
    reopenBlockedReason: isOwnSection ? reason : null,
    publishedLineage,
  };
}

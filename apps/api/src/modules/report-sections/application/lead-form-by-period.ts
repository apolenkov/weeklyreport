import type { ReportSectionReadModel, Role } from "@customreport/shared";

import {
  assertHeadTargetInGroup,
  filterSectionToSharedProducts,
  readSectionForByPeriod,
  resolveCrossAuthorScope,
} from "../domain/lead-form-cross-author-scope";
import {
  computeReopenEligibility,
  LeadFormAccessError,
  type LeadFormRepository,
} from "../domain/lead-form-shared";

export interface GetByPeriodResult {
  section: ReportSectionReadModel;
  readOnly: boolean;
  canRequestReopen: boolean;
  reopenBlockedReason: string | null;
  // Resolve-not-delete: the section's published item/decision lineages, so the
  // form can mark locked records and hide Delete. Advisory for the UI only —
  // the save-path guard enforces the lock.
  publishedLineage: {
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  };
}

const isHeadLikeRole = (role: Role | undefined): boolean =>
  role === "head" || role === "admin";

const isCrossAuthorRequest = (
  requestedAuthorId: string | undefined,
  userId: string,
): requestedAuthorId is string =>
  requestedAuthorId !== undefined && requestedAuthorId !== userId;

const selectSectionAuthor = (
  userId: string,
  requestedAuthorId: string | undefined,
  mayReadRequestedAuthor: boolean,
): string =>
  requestedAuthorId !== undefined && mayReadRequestedAuthor
    ? requestedAuthorId
    : userId;

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
  // `assertHeadTargetInGroup` is only the fast defense-in-depth pre-check;
  // `readSectionForByPeriod` is the actual enforcement — its head-cross branch
  // re-evaluates group membership in the SAME query as the section load.
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
  const isHeadLike = isHeadLikeRole(role);
  // One shared non-archived set gates AND scopes the lead cross-author read
  // (null = not granted, incl. archived-only sharing or no report access). The
  // head branch is group-scoped below; admin is global by design.
  const sharedScope = await resolveCrossAuthorScope(
    repository,
    reportId,
    userId,
    role,
    requestedAuthorId,
  );
  // A head is a single-group role: it may read another author's section only
  // inside its own reporting group. `requestedAuthorId` is a client URL param,
  // so bound it before the target section is loaded. admin is exempt (global).
  const crossAuthorRequest = isCrossAuthorRequest(requestedAuthorId, userId);
  const isHeadCrossRead = role === "head" && crossAuthorRequest;
  if (isHeadCrossRead) {
    await assertHeadTargetInGroup(repository, userId, requestedAuthorId);
  }
  // A lead reading another author's section needs a shared non-archived
  // product. Without one the request is DENIED — never a silent fallback to
  // the caller's own section, which would mislabel the form as the target's.
  // Report access (own section) is checked first: a caller with no section in
  // the report stays on the NOT_FOUND path (no existence oracle).
  const isForeignLeadRead = !isHeadLike && crossAuthorRequest;
  if (isForeignLeadRead && sharedScope === null) {
    const ownSection = await repository.getSectionForPeriod(reportId, userId);
    if (ownSection) {
      throw new LeadFormAccessError(
        "Cannot read another lead's section without a shared product.",
      );
    }
  }
  const sectionAuthorId = selectSectionAuthor(
    userId,
    requestedAuthorId,
    isHeadLike || sharedScope !== null,
  );
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

  // The lead-only Request-Reopen affordance uses the same `computeReopenEligibility`
  // as the write guard, so the button shows exactly when `requestReopen` would
  // succeed; `reopenFacts` never leaves the API.
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

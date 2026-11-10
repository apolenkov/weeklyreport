import {
  type AuthorReportSectionReadModel,
  type PublishedLineage,
  publishedLineageSchema,
  type RecordOmissionSummary,
  type ReopenBlockedReason,
  type Role,
  summarizeRecordOmissions,
  summarizeRecordOmissionsForScopes,
} from "@weeklyreport/shared";

import {
  assertHeadTargetInGroup,
  type ByPeriodRequest,
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
  // The author's own live form may carry unfinished risks and decisions (a
  // missing detail is null). Every other read is the complete projection.
  section: AuthorReportSectionReadModel;
  readOnly: boolean;
  canRequestReopen: boolean;
  reopenBlockedReason: ReopenBlockedReason | null;
  // Resolve-not-delete: the section's published item/decision lineages, so the
  // form can mark locked records and hide Delete. Advisory for the UI only —
  // the save-path guard enforces the lock.
  publishedLineage: PublishedLineage;
  // Another author's section only: how many unfinished risks and decisions
  // the shown content leaves out, within the reader's lens. Totals only, kept
  // apart from the complete content and the statuses derived from it. Absent
  // on the own form, where the author works with the drafts themselves.
  recordOmissions?: RecordOmissionSummary;
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

/** The form read: the author's own section carries their unfinished drafts. */
export function readByPeriod(
  repository: LeadFormRepository,
  request: ByPeriodRequest,
): Promise<GetByPeriodResult> {
  return readSection(repository, request, readOwnDrafts);
}

/**
 * The same authorization and lifecycle, with the complete projection for
 * every reader, the author included. For reads whose output never carries an
 * unfinished record (status overview, open-work authorization).
 */
export function readCompleteByPeriod(
  repository: LeadFormRepository,
  request: ByPeriodRequest,
): Promise<GetByPeriodResult> {
  return readSection(repository, request, () => Promise.resolve(NO_DRAFTS));
}

async function readSection(
  repository: LeadFormRepository,
  request: ByPeriodRequest,
  readOwn: typeof readOwnDrafts,
): Promise<GetByPeriodResult> {
  const { sharedScope, sectionAuthorId, isHeadCrossRead } =
    await resolveSectionAuthor(repository, request);
  // `assertHeadTargetInGroup` is only the fast defense-in-depth pre-check;
  // `readSectionForByPeriod` is the actual enforcement — its head-cross branch
  // re-evaluates group membership in the SAME query as the section load.
  const result = await readSectionForByPeriod(
    repository,
    request,
    sectionAuthorId,
    isHeadCrossRead,
  );
  const isOwnSection = sectionAuthorId === request.userId;
  return buildByPeriodResult(
    repository,
    result,
    sharedScope,
    isOwnSection ? await readOwn(repository, request, result) : null,
  );
}

// The own form shows the author's unfinished drafts too. A published period
// is read from its frozen snapshot, which holds none; what the live section
// still retains there is offered by recovery, not by the form. Null also when
// the author lost the entitlement: the complete read stands.
async function readOwnDrafts(
  repository: LeadFormRepository,
  request: ByPeriodRequest,
  result: Awaited<ReturnType<typeof readSectionForByPeriod>>,
): Promise<OwnRead> {
  const live = result.reopenFacts.periodStatus !== "published";
  return {
    drafts: live
      ? await repository.getOwnDraftSection(request.reportId, request.userId)
      : null,
  };
}

/** Marks the own-form read; `drafts` is the entitled author's live section. */
interface OwnRead {
  readonly drafts: AuthorReportSectionReadModel | null;
}

const NO_DRAFTS: OwnRead = { drafts: null };

async function resolveSectionAuthor(
  repository: LeadFormRepository,
  request: ByPeriodRequest,
): Promise<{
  sharedScope: Awaited<ReturnType<typeof resolveCrossAuthorScope>>;
  sectionAuthorId: string;
  isHeadCrossRead: boolean;
}> {
  const { reportId, userId, role, requestedAuthorId } = request;
  const isHeadLike = isHeadLikeRole(role);
  // One shared non-archived set gates AND scopes the lead cross-author read
  // (null = not granted, incl. archived-only sharing or no report access). The
  // head branch is group-scoped below; admin is global by design.
  const sharedScope = await resolveCrossAuthorScope(repository, request);
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

// A head or admin is shown the whole section, so the whole section is counted.
// A co-owner is shown the shared Products, so only those are counted: nothing
// about the author's other Products or Activities reaches the total.
function scopedRecordOmissions(
  result: Awaited<ReturnType<typeof readSectionForByPeriod>>,
  sharedScope: Awaited<ReturnType<typeof resolveCrossAuthorScope>>,
): RecordOmissionSummary {
  return sharedScope === null
    ? summarizeRecordOmissions([result.recordOmission])
    : summarizeRecordOmissionsForScopes(
        [result.recordOmission],
        [...sharedScope].map((parentId) => ({
          parentKind: "product" as const,
          parentId,
        })),
      );
}

async function buildByPeriodResult(
  repository: LeadFormRepository,
  result: Awaited<ReturnType<typeof readSectionForByPeriod>>,
  sharedScope: Awaited<ReturnType<typeof resolveCrossAuthorScope>>,
  ownRead: OwnRead | null,
): Promise<GetByPeriodResult> {
  const isOwnSection = ownRead !== null;
  // A lead cross-author read returns only the records on products the two
  // leads share; the own-section and head/admin reads return the full section.
  const visible =
    sharedScope !== null
      ? filterSectionToSharedProducts(result.section, sharedScope)
      : result.section;
  const section: AuthorReportSectionReadModel = ownRead?.drafts ?? visible;

  // The lead-only Request-Reopen affordance uses the same `computeReopenEligibility`
  // as the write guard, so the button shows exactly when `requestReopen` would
  // succeed; `reopenFacts` never leaves the API.
  const { canRequestReopen, reason } = computeReopenEligibility(
    result.reopenFacts,
  );

  // Computed over the (possibly product-filtered) section actually returned,
  // so a cross-author read never leaks lineage of records it does not show.
  const publishedLineage = publishedLineageSchema.parse(
    await repository.getPublishedLineage(section),
  );

  return {
    section,
    readOnly: result.readOnly || !isOwnSection,
    canRequestReopen: isOwnSection && canRequestReopen,
    reopenBlockedReason: isOwnSection ? reason : null,
    publishedLineage,
    ...(isOwnSection
      ? {}
      : { recordOmissions: scopedRecordOmissions(result, sharedScope) }),
  };
}

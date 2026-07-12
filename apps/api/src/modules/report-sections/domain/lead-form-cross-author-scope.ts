import type { ReportSectionReadModel, Role } from "@customreport/shared";

import {
  LeadFormAccessError,
  LeadFormDomainError,
  type LeadFormRepository,
  type ReopenEligibilityFacts,
} from "./lead-form-shared";

/**
 * Lead cross-author read scoping: resolving the shared-product scope for a
 * requested foreign author, and filtering a section's product-keyed
 * collections down to that scope.
 */

/**
 * Resolve the lead cross-author read's product scope. Returns the shared
 * non-archived product-id set ONLY when the caller is a lead requesting
 * another author AND holds their own section in the report (report access is
 * report-independent co-ownership's missing half) AND co-owns at least one
 * non-archived product with that author. Every other case — head/admin,
 * own-section, no report access, or archived-only co-ownership — returns null,
 * so `getByPeriod` reads the caller's own section and exposes no foreign
 * status, metadata, or records.
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

/**
 * Bound a head's cross-author read to its own reporting group. A head is a
 * single-group role, so it may read another author's section only when that
 * author shares the head's group. `targetAuthorId` reaches the caller from a
 * client URL param, so resolve both groups and reject a cross-group target with
 * a 403-equivalent access error before any section is loaded. A head with no
 * group (null) is rejected too (fail closed). admin never calls this — it reads
 * globally.
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

/**
 * The `getByPeriod` section load, branching on `isHeadCrossRead`: a head's
 * cross-author read goes through the atomic, group-scoped
 * `getSectionForPeriodAsGroupPeer` (the group predicate is evaluated in the
 * same query as the read, so `assertHeadTargetInGroup`'s separate pre-check
 * cannot be raced by a concurrent group reassignment); every other caller
 * keeps the unscoped `getSectionForPeriod`. A null result on the head-cross
 * path is `LeadFormAccessError` (fail closed, no existence leak); elsewhere
 * it is the generic `LeadFormDomainError`.
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

/**
 * Scope a foreign section's product-keyed collections to the products the
 * viewer co-owns. Every product-scoped collection the read model exposes is
 * filtered: items (current and next week), risks, decisions, and the `projects`
 * array — whose entries carry the per-stage statuses, traffic light, owned
 * stages, and stage set, so dropping an unshared entry removes its whole card
 * and stage grid. `referencedProjects` is recomputed from the surviving rows so
 * a dropped unshared product can never re-leak its name. A decision may carry a
 * null/undefined `productId` — a cross-cutting, non-product-scoped decision; it
 * is NOT a record on an unshared product, so the scoping has no reason to hide
 * it and it is kept. An activity-parented item/risk/decision carries a null
 * product FK and IS dropped here (this lens is product-scoped). Section-identity
 * fields (status, version, author, submittedAt) are preserved unchanged.
 *
 * Ceiling: this shared-product lens never exposes a field the curated Everyone
 * lens (`CrossAuthorSectionRow`) omits. `activities` (per-activity status +
 * free-text notes) and `reviews` are on this read model but absent from the
 * Everyone lens, so they are stripped — `activities` emptied (the read model
 * requires the array), `reviews` dropped — rather than passed through the
 * spread.
 */
export function filterSectionToSharedProducts(
  section: ReportSectionReadModel,
  sharedProductIds: ReadonlySet<string>,
): ReportSectionReadModel {
  // activity-first-class: this lens is product-scoped — an activity-parented
  // item/risk (null product FK) is on no shared product and is dropped, the
  // same way a non-shared-product decision is.
  const items = section.items.filter(
    (i) => i.projectId != null && sharedProductIds.has(i.projectId),
  );
  const risks = section.risks.filter(
    (r) => r.projectId != null && sharedProductIds.has(r.projectId),
  );
  // Mirror getCrossAuthorContent's `sharedIds.has(d.productId)`: a cross-author
  // co-lead view drops every decision not on a shared product — INCLUDING a
  // null-productId (cross-cutting/group) decision — so this byPeriod lens
  // discloses exactly what the curated Everyone lens does, never more.
  const decisions = section.decisions.filter(
    (d) => d.productId != null && sharedProductIds.has(d.productId),
  );
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

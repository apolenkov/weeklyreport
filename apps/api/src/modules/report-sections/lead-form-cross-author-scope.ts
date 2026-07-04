import type { ReportSectionReadModel, Role } from "@customreport/shared";

import type { LeadFormRepository } from "./lead-form-shared";

/**
 * Lead cross-author read scoping, split out of `lead-form.service.ts`
 * (R3a-4 max-lines drain): resolving the shared-product scope for a
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
  return { ...section, items, risks, decisions, projects, referencedProjects };
}

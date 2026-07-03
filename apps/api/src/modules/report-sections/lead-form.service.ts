import type { ReportSectionReadModel, Role } from "@customreport/shared";

import {
  customreportCrossAuthorContentReadsTotal,
  customreportReopenRequestsTotal,
} from "../../infrastructure/metrics/metrics.registry.js";
import {
  computeReopenEligibility,
  type CrossAuthorSectionRow,
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  type LeadFormRepository,
  reopenBlockedMessage,
  ReopenRequestError,
} from "./lead-form-shared";
import { ReportSectionDomainError } from "./report-sections.service.js";

// Re-export the error classes and shared types from their original module
// path so every existing importer (`./lead-form.service`) resolves unchanged.
// The error classes have a single definition (in `lead-form-shared.ts`) so
// `instanceof` checks in the tRPC error-mapper stay valid.
export type {
  CrossAuthorSectionRow,
  LeadFormRepository,
  ReopenEligibilityFacts,
} from "./lead-form-shared";
export {
  computeReopenEligibility,
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  ReopenRequestError,
} from "./lead-form-shared";

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
function filterSectionToSharedProducts(
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

/**
 * Lead-form facade: reopen / cross-author / revoke / by-period / fill-from.
 * The version-history and snapshot surfaces were removed entirely
 * (defer-versions-coming-soon); TODO(versions-v2) marks the re-entry points.
 */
export class LeadFormService {
  constructor(private readonly repository: LeadFormRepository) {}

  /**
   * API-03: Revoke a lead's submission (head-only). The injected
   * `scope` is the caller's `reportSection` group-scope fragment — the section
   * is loaded WITH the scope applied, so a head cannot revoke another group's
   * section by passing its id. An out-of-group (or missing) id resolves to null
   * and is rejected as `LeadFormDomainError` (mapped to NOT_FOUND — no existence
   * oracle); admin scope is `{}` (global).
   */
  async revokeSubmission(
    sectionId: string,
    revokedByUserId: string,
    scope: Record<string, unknown>,
  ): Promise<{ success: true }> {
    const section = await this.repository.getSectionByIdScoped(
      sectionId,
      scope,
    );

    if (!section) {
      throw new LeadFormDomainError(`Section ${sectionId} not found.`);
    }

    if (section.status !== "submitted") {
      throw new LeadFormConstraintError(
        "Only submitted sections can be revoked.",
      );
    }

    await this.repository.revokeSectionSubmission(sectionId, revokedByUserId);
    return { success: true };
  }

  /** API-07: Fill current form from a past period's data. */
  async fillFrom(
    targetSectionId: string,
    sourceSectionId: string,
    userId: string,
    // Client-loaded version of the TARGET, for the optimistic-concurrency
    // compare-and-set (not the freshly-fetched row's — that would no-op the
    // lock). A concurrent edit of the target rejects with CONFLICT.
    expectedVersion: number,
  ): Promise<{ success: true; copiedItems: number }> {
    const target = await this.repository.getSectionById(targetSectionId);

    if (!target) {
      throw new LeadFormDomainError(
        `Target section ${targetSectionId} not found.`,
      );
    }

    if (target.authorId !== userId) {
      throw new LeadFormAccessError("Can only fill your own section.");
    }

    if (target.status === "submitted") {
      throw new LeadFormConstraintError("Cannot fill a submitted section.");
    }

    // viewer-report-surface-parity (review P1): refuse to mutate the live rows
    // of a PUBLISHED period. The viewer's published search reads live Item/Risk/
    // Decision rows, but the viewer content read serves the frozen publish
    // snapshot — letting fillFrom rewrite a (draft) section inside a published
    // report would make a viewer's search snippet reveal content absent from the
    // report they can open. saveDraft/saveSection already block published edits;
    // fillFrom was the one gap. Gate on periodStatus (the searchable column):
    // a reopened period (periodStatus='reopened') is editable again and is
    // excluded from the viewer's published search, so it stays allowed.
    const periodStatus =
      await this.repository.getReportPeriodStatusForSection(targetSectionId);
    if (periodStatus === "published") {
      throw new LeadFormConstraintError(
        "Cannot fill a section of a published report.",
      );
    }

    // Resolve-not-delete (ADR 0015) also binds Fill From: it delete-recreates
    // the target's items/decisions with fresh identity, which would silently
    // destroy any published-lineage record on a REOPENED period (the
    // periodStatus gate above only blocks a still-published one). Fail closed —
    // reject the whole fill if the target holds any published-lineage record;
    // a never-published draft has none and is unaffected. The same lineage
    // query the save guard uses.
    const published = await this.repository.getPublishedLineage(target);
    if (
      published.itemStableIds.length > 0 ||
      published.decisionStableIds.length > 0
    ) {
      throw new ReportSectionDomainError(
        "PUBLISHED_RECORD_LOCKED",
        "Fill from previous cannot replace records that are part of the published report.",
      );
    }

    // Authorize the SOURCE section too. The fill-from picker only ever offers
    // the lead's OWN past sections (`LeadReportPeriod.sourceSectionId` is sourced
    // from `MyHistoryEntry.sectionId`), so any sourceSectionId authored by
    // someone else is a forged request — without this guard a lead could copy
    // another group's Item/Risk/Decision content into their own draft on an open
    // report. fillFrom copies your own history; it is never cross-author.
    const source = await this.repository.getSectionById(sourceSectionId);
    if (!source) {
      throw new LeadFormDomainError(
        `Source section ${sourceSectionId} not found.`,
      );
    }
    if (source.authorId !== userId) {
      throw new LeadFormAccessError("Can only fill from your own section.");
    }

    // TODO(versions-v2): a pre-overwrite safety snapshot was taken here
    // until version snapshots were removed (defer-versions-coming-soon).
    const copiedItems = await this.repository.fillFromSection(
      targetSectionId,
      sourceSectionId,
      expectedVersion,
    );

    return { success: true, copiedItems };
  }

  /** API-04: Request the head to reopen a submitted section. */
  async requestReopen(
    sectionId: string,
    userId: string,
    reason?: string,
  ): Promise<{ success: true }> {
    // reopen-request-lifecycle (D4): one read carries ownership + the lifecycle
    // facts, and `computeReopenEligibility` is the SAME function that drives the
    // lead-form `canRequestReopen` flag — so the server guard and the button can
    // never drift. Ownership → FORBIDDEN; a missing section → NOT_FOUND; a
    // lifecycle/one-pending block → BAD_REQUEST.
    const context = await this.repository.getSectionReopenContext(sectionId);

    if (!context) {
      throw new LeadFormDomainError(`Section ${sectionId} not found.`);
    }

    if (context.authorId !== userId) {
      throw new LeadFormAccessError(
        "Can only request reopen for your own section.",
      );
    }

    const { canRequestReopen, reason: blockedReason } =
      computeReopenEligibility(context.facts);
    if (!canRequestReopen && blockedReason !== null) {
      throw new ReopenRequestError(reopenBlockedMessage(blockedReason));
    }

    await this.repository.createReopenRequest(sectionId, userId, reason);
    // Phase 52-A (UFB-054): product telemetry. `state='requested'` is the
    // funnel's entry — paired with `approved` / `rejected` from the admin
    // mutation it gives leadership the full demand-vs-policy picture.
    customreportReopenRequestsTotal.inc({ state: "requested" });
    return { success: true };
  }

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
  private async resolveCrossAuthorScope(
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
    const ownSection = await this.repository.getSectionForPeriod(
      reportId,
      userId,
    );
    if (!ownSection) {
      return null;
    }
    const sharedProductIds =
      await this.repository.getSharedNonArchivedProductIds(
        userId,
        requestedAuthorId,
      );
    return sharedProductIds.length > 0 ? new Set(sharedProductIds) : null;
  }

  /** API-10: Get lead form for a specific period. */
  async getByPeriod(
    reportId: string,
    userId: string,
    role?: Role,
    requestedAuthorId?: string,
  ): Promise<{
    section: ReportSectionReadModel;
    readOnly: boolean;
    canRequestReopen: boolean;
    reopenBlockedReason: string | null;
    /**
     * Resolve-not-delete (ADR 0015): the section's published item/decision
     * lineages, so the form can mark locked records and hide Delete. Advisory
     * for the UI only — the save-path guard enforces the lock.
     */
    publishedLineage: {
      itemStableIds: readonly string[];
      decisionStableIds: readonly string[];
    };
  }> {
    const isHeadLike = role === "head" || role === "admin";
    // One shared non-archived set gates AND scopes the lead cross-author read
    // (null = not a granted cross-author read, including archived-only sharing
    // or no report access). The head/admin branch is group-scoped elsewhere.
    const sharedScope = await this.resolveCrossAuthorScope(
      reportId,
      userId,
      role,
      requestedAuthorId,
    );
    const sectionAuthorId =
      requestedAuthorId !== undefined && (isHeadLike || sharedScope !== null)
        ? requestedAuthorId
        : userId;
    const result = await this.repository.getSectionForPeriod(
      reportId,
      sectionAuthorId,
    );

    if (!result) {
      throw new LeadFormDomainError(
        `No section found for user in report ${reportId}.`,
      );
    }

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
    const publishedLineage = await this.repository.getPublishedLineage(section);

    return {
      section,
      readOnly: result.readOnly || !isOwnSection,
      canRequestReopen: isOwnSection && canRequestReopen,
      reopenBlockedReason: isOwnSection ? reason : null,
      publishedLineage,
    };
  }

  async getCrossAuthors(
    reportId: string,
    userId: string,
    role?: Role,
  ): Promise<
    {
      projectId: string;
      projectName: string;
      authorId: string;
      authorInitials: string;
      authorShortName: string;
      stageNames: string[];
      stages: {
        stageName: string;
        status: "green" | "yellow" | "red" | null;
      }[];
    }[]
  > {
    const isHeadLike = role === "head" || role === "admin";
    if (!isHeadLike) {
      const ownSection = await this.repository.getSectionForPeriod(
        reportId,
        userId,
      );
      if (!ownSection) {
        return [];
      }
    }
    return this.repository.getCrossAuthors(reportId, userId);
  }

  /**
   * Full-content cross-author read for the lead form's "Everyone" visibility
   * lens. Strictly more sensitive than the status-only `getCrossAuthors`, so
   * gated harder (design D6): the caller must (a) have access to the report —
   * own a section in it — AND (b) co-own the product whose foreign records are
   * requested. There is NO head/admin bypass: a head or admin who does not
   * co-own the product is denied, exactly like any other non-co-owner. The
   * gate never keys off the lead-form toggle (the toggle only decides whether
   * the request is issued, never whether it is authorized).
   *
   * The response payload is empty in BOTH the denied and the legitimately
   * empty case (no leak). Only the observability counter distinguishes them
   * (D6b): `denied` = no report access OR no co-ownership; `empty` = co-owns a
   * shared product but the co-owner authored no records; `allowed` = foreign
   * records returned.
   */
  async getCrossAuthorContent(
    reportId: string,
    userId: string,
  ): Promise<CrossAuthorSectionRow[]> {
    // (a) Report access — own a section in this report. No role bypass.
    const ownSection = await this.repository.getSectionForPeriod(
      reportId,
      userId,
    );
    if (!ownSection) {
      customreportCrossAuthorContentReadsTotal.inc({ result: "denied" });
      return [];
    }

    // (b) Co-ownership + content. The repository returns `coOwnsShared`
    // separately from row-emptiness so denied and empty stay distinguishable.
    const { coOwnsShared, rows } = await this.repository.getCrossAuthorContent(
      reportId,
      userId,
    );
    if (!coOwnsShared) {
      customreportCrossAuthorContentReadsTotal.inc({ result: "denied" });
      return [];
    }

    customreportCrossAuthorContentReadsTotal.inc({
      result: rows.length > 0 ? "allowed" : "empty",
    });
    return rows;
  }

  /**
   * SC-165: Revoke every submitted section in a report. The injected
   * `scope` (the caller's `reportSection` group-scope fragment) is forwarded to
   * the repository's scoped `updateMany`, so a head revokes only their own
   * group's submissions; `revokedCount` reflects only the authorized rows.
   */
  async revokeAllSubmitted(
    reportId: string,
    revokedByUserId: string,
    scope: Record<string, unknown>,
  ): Promise<{ success: true; revokedCount: number }> {
    const count = await this.repository.revokeAllSubmitted(
      reportId,
      revokedByUserId,
      scope,
    );
    return { success: true, revokedCount: count };
  }
}

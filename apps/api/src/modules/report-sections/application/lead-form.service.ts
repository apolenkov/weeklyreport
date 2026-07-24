import type { Role } from "@customreport/shared";

import {
  computeReopenEligibility,
  type CrossAuthorSectionRow,
  type CrossAuthorStatusRow,
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  type LeadFormRepository,
  reopenBlockedMessage,
  ReopenRequestError,
} from "../domain/lead-form-shared";
import {
  assertFillableSource,
  assertFillableTarget,
  assertNoPublishedLineage,
} from "./fill-from-guards.js";
import { type GetByPeriodResult, readByPeriod } from "./lead-form-by-period.js";
import {
  NOOP_REPORT_SECTIONS_TELEMETRY,
  type ReportSectionsTelemetry,
} from "./report-sections-telemetry.port.js";

// Re-export the error classes and shared types from their original module
// path so every existing importer (`./lead-form.service`) resolves unchanged.
// The error classes have a single definition (in `lead-form-shared.ts`) so
// `instanceof` checks in the tRPC error-mapper stay valid.
export type {
  CrossAuthorSectionRow,
  LeadFormRepository,
  ReopenEligibilityFacts,
} from "../domain/lead-form-shared";
export {
  computeReopenEligibility,
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  ReopenRequestError,
} from "../domain/lead-form-shared";

// DI token binding the LeadFormRepository port to its adapter at the module
// boundary — the service depends on the port, not the prisma class.
export const LEAD_FORM_REPOSITORY = Symbol("LeadFormRepository");

/**
 * Lead-form facade: reopen / cross-author / revoke / by-period / fill-from.
 * The version-history and snapshot surfaces were removed entirely
 * (defer-versions-coming-soon); TODO(versions-v2) marks the re-entry points.
 */
export class LeadFormService {
  constructor(
    private readonly repository: LeadFormRepository,
    private readonly telemetry: ReportSectionsTelemetry = NOOP_REPORT_SECTIONS_TELEMETRY,
  ) {}

  /**
   * Revoke a lead's submission (head-only). The injected
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

    // Same published-period gate as fillFrom/saveDraft: the dashboard only
    // surfaces revoke for the CURRENT period, so this alone protects closed
    // published reports; a reopened period stays revocable.
    await this.assertPeriodNotPublished(sectionId, "revoke a submission in");

    await this.repository.revokeSectionSubmission(sectionId, revokedByUserId);
    return { success: true };
  }

  /**
   * Rejects when the section's report is a still-published period. Message
   * template — grep anchors for the exact thrown strings:
   * "Cannot fill a section of a published report." /
   * "Cannot revoke a submission in a published report."
   */
  private async assertPeriodNotPublished(sectionId: string, action: string) {
    const status =
      await this.repository.getReportPeriodStatusForSection(sectionId);
    if (status === "published")
      throw new LeadFormConstraintError(`Cannot ${action} a published report.`);
  }

  /** Fill current form from a past period's data. */
  async fillFrom(
    targetSectionId: string,
    sourceSectionId: string,
    userId: string,
    // Client-loaded version of the TARGET, for the optimistic-concurrency
    // compare-and-set (not the freshly-fetched row's — that would no-op the
    // lock). A concurrent edit of the target rejects with CONFLICT.
    expectedVersion: number,
  ): Promise<{ success: true; copiedItems: number }> {
    const target = await assertFillableTarget(
      this.repository,
      targetSectionId,
      userId,
    );

    // Refuse to mutate the live rows of a PUBLISHED period. The viewer's
    // published search reads live Item/Risk/Decision rows, but the viewer
    // content read serves the frozen publish snapshot — letting fillFrom
    // rewrite a (draft) section inside a published report would make a
    // viewer's search snippet reveal content absent from the report they can
    // open. saveDraft/saveSection already block published edits; fillFrom is
    // gated the same way. Gate on periodStatus (the searchable column): a
    // reopened period (periodStatus='reopened') is editable again and is
    // excluded from the viewer's published search, so it stays allowed.
    await this.assertPeriodNotPublished(targetSectionId, "fill a section of");
    await assertNoPublishedLineage(this.repository, target);
    await assertFillableSource(this.repository, sourceSectionId, userId);

    // TODO(versions-v2): a pre-overwrite safety snapshot was taken here
    // until version snapshots were removed (defer-versions-coming-soon).
    const copiedItems = await this.repository.fillFromSection(
      targetSectionId,
      sourceSectionId,
      expectedVersion,
    );

    return { success: true, copiedItems };
  }

  /** Request the head to reopen a submitted section. */
  async requestReopen(
    sectionId: string,
    userId: string,
    reason?: string,
  ): Promise<{ success: true }> {
    // One read carries ownership + the lifecycle facts, and
    // `computeReopenEligibility` is the SAME function that drives the lead-form
    // `canRequestReopen` flag — so the server guard and the button can never
    // drift. Ownership → FORBIDDEN; a missing section → NOT_FOUND; a
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
    // Product telemetry. `state='requested'` is the funnel's entry — paired
    // with `approved` / `rejected` from the admin mutation it gives leadership
    // the full demand-vs-policy picture.
    this.telemetry.recordReopenRequest("requested");
    return { success: true };
  }

  /** Get lead form for a specific period. */
  async getByPeriod(
    reportId: string,
    userId: string,
    role?: Role,
    requestedAuthorId?: string,
  ): Promise<GetByPeriodResult> {
    return readByPeriod(
      this.repository,
      reportId,
      userId,
      role,
      requestedAuthorId,
    );
  }

  async getCrossAuthors(
    reportId: string,
    userId: string,
    role?: Role,
  ): Promise<CrossAuthorStatusRow[]> {
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
   * gated harder: the caller must (a) have access to the report —
   * own a section in it — AND (b) co-own the product whose foreign records are
   * requested. There is NO head/admin bypass: a head or admin who does not
   * co-own the product is denied, exactly like any other non-co-owner. The
   * gate never keys off the lead-form toggle (the toggle only decides whether
   * the request is issued, never whether it is authorized).
   *
   * The response payload is empty in BOTH the denied and the legitimately
   * empty case (no leak). Only the observability counter distinguishes them:
   * `denied` = no report access OR no co-ownership; `empty` = co-owns a shared
   * product but the co-owner authored no records; `allowed` = foreign records
   * returned.
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
      this.telemetry.recordCrossAuthorRead("denied");
      return [];
    }

    // (b) Co-ownership + content. The repository returns `coOwnsShared`
    // separately from row-emptiness so denied and empty stay distinguishable.
    const { coOwnsShared, rows } = await this.repository.getCrossAuthorContent(
      reportId,
      userId,
    );
    if (!coOwnsShared) {
      this.telemetry.recordCrossAuthorRead("denied");
      return [];
    }

    this.telemetry.recordCrossAuthorRead(rows.length > 0 ? "allowed" : "empty");
    return rows;
  }

  /**
   * Revoke every submitted section in a report. The injected
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

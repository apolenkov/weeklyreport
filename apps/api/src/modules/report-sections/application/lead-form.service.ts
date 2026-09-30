import {
  type LeadOpenWorkHistoryInput,
  type PromotePlanInput,
  promotePlanInputSchema,
  type ReportSectionReadModel,
  type ResolvePlanInput,
  resolvePlanInputSchema,
  type RestorePlanInput,
  restorePlanInputSchema,
  type Role,
} from "@customreport/shared";

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
  assertDistinctFillSections,
  assertFillableSource,
  assertFillableTarget,
  assertNoPublishedLineage,
} from "./fill-from-guards.js";
import { type GetByPeriodResult, readByPeriod } from "./lead-form-by-period.js";
import { readLeadOpenWork } from "./lead-form-open-work.js";
import { readStatusOverview } from "./lead-form-status-overview.js";
import type { ReportSectionsTelemetry } from "./report-sections-telemetry.port.js";

// Single error definitions live in lead-form-shared (instanceof stays valid).
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

export const LEAD_FORM_REPOSITORY = Symbol("LeadFormRepository");

export class LeadFormService {
  constructor(
    private readonly repository: LeadFormRepository,
    private readonly telemetry: ReportSectionsTelemetry,
  ) {}

  resolvePlan(command: ResolvePlanInput, userId: string) {
    return this.repository.resolvePlan(
      resolvePlanInputSchema.parse(command),
      userId,
    );
  }

  restorePlan(command: RestorePlanInput, userId: string) {
    return this.repository.restorePlan(
      restorePlanInputSchema.parse(command),
      userId,
    );
  }

  promotePlan(command: PromotePlanInput, userId: string) {
    return this.repository.promotePlan(
      promotePlanInputSchema.parse(command),
      userId,
    );
  }

  getOpenWork(input: LeadOpenWorkHistoryInput, userId: string) {
    return readLeadOpenWork(this.repository, input, userId);
  }

  // Scope-applied load: out-of-group id → NOT_FOUND (no existence oracle).
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

  // Gate on periodStatus published; reopened stays editable.
  private async assertPeriodNotPublished(sectionId: string, action: string) {
    const status =
      await this.repository.getReportPeriodStatusForSection(sectionId);
    if (status === "published")
      throw new LeadFormConstraintError(`Cannot ${action} a published report.`);
  }

  async fillFrom(
    targetSectionId: string,
    sourceSectionId: string,
    userId: string,
    // Client-loaded target version for OCC; fresh-fetch would no-op the lock.
    expectedVersion: number,
  ): Promise<{
    success: true;
    copiedItems: number;
    section?: ReportSectionReadModel;
  }> {
    // Argument-level guard first: self-fill rejects before any repository read.
    assertDistinctFillSections(targetSectionId, sourceSectionId);
    const target = await assertFillableTarget(
      this.repository,
      targetSectionId,
      userId,
    );

    // Same published-period gate as saveDraft: search vs frozen snapshot would diverge.
    await this.assertPeriodNotPublished(targetSectionId, "fill a section of");
    await assertNoPublishedLineage(this.repository, target);
    await assertFillableSource(this.repository, sourceSectionId, userId);

    const copiedItems = await this.repository.fillFromSection(
      targetSectionId,
      sourceSectionId,
      expectedVersion,
    );

    const section = await this.repository.getSectionById(targetSectionId);
    return {
      success: true,
      copiedItems,
      ...(section ? { section } : {}),
    };
  }

  async requestReopen(
    sectionId: string,
    userId: string,
    reason?: string,
  ): Promise<{ success: true }> {
    // Same computeReopenEligibility as the canRequestReopen button — no drift.
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

  async getByPeriod(
    reportId: string,
    userId: string,
    role?: Role,
    requestedAuthorId?: string,
  ): Promise<GetByPeriodResult> {
    return readByPeriod(this.repository, {
      reportId,
      userId,
      role,
      requestedAuthorId,
    });
  }

  async getStatusOverview(
    reportId: string,
    userId: string,
    role: Role,
    requestedAuthorId?: string,
  ) {
    return readStatusOverview(this.repository, {
      reportId,
      userId,
      role,
      requestedAuthorId,
    });
  }

  async getCrossAuthors(
    reportId: string,
    userId: string,
    role?: Role,
  ): Promise<CrossAuthorStatusRow[]> {
    return this.repository.getCrossAuthors(reportId, userId, role);
  }

  // Report access + co-ownership required; no head/admin bypass. Empty payload
  // for both denied and legitimately empty; telemetry distinguishes them.
  async getCrossAuthorContent(
    reportId: string,
    userId: string,
  ): Promise<CrossAuthorSectionRow[]> {
    // Report access, co-ownership, lifecycle, and content are proven by one
    // repository transaction. The repository returns `coOwnsShared`
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

  // Scope forwarded to updateMany so heads revoke only their group's rows.
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

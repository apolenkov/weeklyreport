import type { ReportSectionReadModel, Role } from "@customreport/shared";

import { customreportReopenRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import {
  LeadFormDomainError,
  type LeadFormRepository,
} from "./lead-form-shared";

// Re-export the error classes and shared types from their original module
// path so every existing importer (`./lead-form.service`) resolves unchanged.
// The error classes have a single definition (in `lead-form-shared.ts`) so
// `instanceof` checks in the tRPC error-mapper stay valid.
export type { LeadFormRepository } from "./lead-form-shared";
export { LeadFormAccessError, LeadFormDomainError } from "./lead-form-shared";

/**
 * Lead-form facade: reopen / cross-author / revoke / by-period / fill-from.
 * The version-history and snapshot surfaces were removed entirely
 * (defer-versions-coming-soon); TODO(versions-v2) marks the re-entry points.
 */
export class LeadFormService {
  constructor(private readonly repository: LeadFormRepository) {}

  /** API-03: Revoke a lead's submission (head-only). */
  async revokeSubmission(
    sectionId: string,
    revokedByUserId: string,
  ): Promise<{ success: true }> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    if (section.status !== "submitted") {
      throw new Error("Only submitted sections can be revoked.");
    }

    await this.repository.revokeSectionSubmission(sectionId, revokedByUserId);
    return { success: true };
  }

  /** API-07: Fill current form from a past period's data. */
  async fillFrom(
    targetSectionId: string,
    sourceSectionId: string,
    userId: string,
  ): Promise<{ success: true; copiedItems: number }> {
    const target = await this.repository.getSectionById(targetSectionId);

    if (!target) {
      throw new Error(`Target section ${targetSectionId} not found.`);
    }

    if (target.authorId !== userId) {
      throw new Error("Can only fill your own section.");
    }

    if (target.status === "submitted") {
      throw new Error("Cannot fill a submitted section.");
    }

    // TODO(versions-v2): a pre-overwrite safety snapshot was taken here
    // until version snapshots were removed (defer-versions-coming-soon).
    const copiedItems = await this.repository.fillFromSection(
      targetSectionId,
      sourceSectionId,
    );

    return { success: true, copiedItems };
  }

  /** API-04: Request the head to reopen a submitted section. */
  async requestReopen(
    sectionId: string,
    userId: string,
    reason?: string,
  ): Promise<{ success: true }> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    if (section.authorId !== userId) {
      throw new Error("Can only request reopen for your own section.");
    }

    if (section.status !== "submitted") {
      throw new Error("Only submitted sections can request reopen.");
    }

    await this.repository.createReopenRequest(sectionId, userId, reason);
    // Phase 52-A (UFB-054): product telemetry. `state='requested'` is the
    // funnel's entry — paired with `approved` / `rejected` from the admin
    // mutation it gives leadership the full demand-vs-policy picture.
    customreportReopenRequestsTotal.inc({ state: "requested" });
    return { success: true };
  }

  /** API-10: Get lead form for a specific period. */
  async getByPeriod(
    reportId: string,
    userId: string,
    role?: Role,
    requestedAuthorId?: string,
  ): Promise<{ section: ReportSectionReadModel; readOnly: boolean }> {
    const isHeadLike = role === "head" || role === "admin";
    const canViewOtherAuthor =
      isHeadLike ||
      (role === "lead" &&
        requestedAuthorId !== undefined &&
        (await this.repository.hasSharedProduct(userId, requestedAuthorId)));
    const sectionAuthorId =
      requestedAuthorId && canViewOtherAuthor ? requestedAuthorId : userId;
    const result = await this.repository.getSectionForPeriod(
      reportId,
      sectionAuthorId,
    );

    if (!result) {
      throw new LeadFormDomainError(
        `No section found for user in report ${reportId}.`,
      );
    }

    return {
      ...result,
      readOnly: result.readOnly || sectionAuthorId !== userId,
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

  /** SC-165: Revoke every submitted section in a report in one transaction. */
  async revokeAllSubmitted(
    reportId: string,
    revokedByUserId: string,
  ): Promise<{ success: true; revokedCount: number }> {
    const count = await this.repository.revokeAllSubmitted(
      reportId,
      revokedByUserId,
    );
    return { success: true, revokedCount: count };
  }
}

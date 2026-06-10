import type {
  ReportSectionReadModel,
  Role,
  VersionSnapshot,
} from "@customreport/shared";

import { customreportReopenRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import {
  type CrossAuthorSectionRow,
  LeadFormDomainError,
  type LeadFormRepository,
} from "./lead-form-shared";
import { SnapshotService } from "./snapshot.service";
import { VersionHistoryService } from "./version-history.service";

// Re-export the error classes and shared types from their original module
// path so every existing importer (`./lead-form.service`) resolves unchanged
// after the version/snapshot extraction (code-quality-modernization, Wave 3).
// The error classes have a single definition (in `lead-form-shared.ts`) so
// `instanceof` checks in the tRPC error-mapper stay valid.
export type {
  CreateSnapshotResult,
  CrossAuthorSectionRow,
  LeadFormRepository,
  SnapshotLatestRow,
} from "./lead-form-shared";
export { LeadFormAccessError, LeadFormDomainError } from "./lead-form-shared";

/**
 * Lead-form facade. The version-history surface (fill-from, list/get/
 * restore) and the autosave snapshot surface (throttle + dedup) were
 * extracted into `VersionHistoryService` / `SnapshotService`
 * (code-quality-modernization, Wave 3, HOT ZONE). This class keeps the
 * reopen / cross-author / revoke / by-period surface and delegates the
 * version + snapshot methods verbatim, so the public method surface,
 * signatures, and behavior are unchanged.
 */
export class LeadFormService {
  private readonly versionHistory: VersionHistoryService;
  private readonly snapshots: SnapshotService;

  constructor(private readonly repository: LeadFormRepository) {
    this.versionHistory = new VersionHistoryService(repository);
    this.snapshots = new SnapshotService(repository);
  }

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
  fillFrom(
    targetSectionId: string,
    sourceSectionId: string,
    userId: string,
  ): Promise<{ success: true; copiedItems: number }> {
    return this.versionHistory.fillFrom(
      targetSectionId,
      sourceSectionId,
      userId,
    );
  }

  /** API-08: List version snapshots for a section. */
  listVersions(
    sectionId: string,
    userId: string,
    role?: Role,
  ): Promise<VersionSnapshot[]> {
    return this.versionHistory.listVersions(sectionId, userId, role);
  }

  getVersion(
    sectionId: string,
    version: number,
    userId: string,
    role?: Role,
  ): Promise<Record<string, unknown> | null> {
    return this.versionHistory.getVersion(sectionId, version, userId, role);
  }

  /** API-09: Restore a section to a specific version. */
  restoreVersion(
    sectionId: string,
    version: number,
    userId: string,
  ): Promise<{ success: true; restoredVersion: number }> {
    return this.versionHistory.restoreVersion(sectionId, version, userId);
  }

  /** add-version-pin: Pin or unpin a version of a lead's own section. */
  setVersionPinned(
    sectionId: string,
    version: number,
    pinned: boolean,
    userId: string,
  ): ReturnType<VersionHistoryService["setVersionPinned"]> {
    return this.versionHistory.setVersionPinned(
      sectionId,
      version,
      pinned,
      userId,
    );
  }

  /**
   * Create an explicit version snapshot of the current section state.
   * Delegated to {@link SnapshotService}; throttle + content-dedup
   * semantics are unchanged.
   */
  createSnapshot(
    sectionId: string,
    userId: string,
  ): ReturnType<SnapshotService["createSnapshot"]> {
    return this.snapshots.createSnapshot(sectionId, userId);
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
  ): Promise<
    {
      projectId: string;
      projectName: string;
      authorId: string;
      authorName: string;
      stageNames: string[];
      stages: {
        stageName: string;
        status: "green" | "yellow" | "red" | null;
      }[];
      itemCount: number;
      riskCount: number;
    }[]
  > {
    return this.repository.getCrossAuthors(reportId, userId);
  }

  async getCrossAuthorSections(
    reportId: string,
    userId: string,
  ): Promise<CrossAuthorSectionRow[]> {
    return this.repository.getCrossAuthorSections(reportId, userId);
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

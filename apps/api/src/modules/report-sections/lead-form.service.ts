import type {
  ReportSectionReadModel,
  Role,
  VersionSnapshot,
} from "@customreport/shared";

import { customreportReopenRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";

export class LeadFormDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadFormDomainError";
  }
}

export class LeadFormAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadFormAccessError";
  }
}

export interface LeadFormRepository {
  getSectionById(sectionId: string): Promise<ReportSectionReadModel | null>;
  getSectionForPeriod(
    reportId: string,
    userId: string,
  ): Promise<{ section: ReportSectionReadModel; readOnly: boolean } | null>;
  revokeSectionSubmission(sectionId: string, revokedBy: string): Promise<void>;
  fillFromSection(
    targetSectionId: string,
    sourceSectionId: string,
  ): Promise<number>;
  listVersions(sectionId: string): Promise<VersionSnapshot[]>;
  restoreVersion(sectionId: string, version: number): Promise<number>;
  createVersionSnapshot(sectionId: string): Promise<void>;
  createReopenRequest(
    sectionId: string,
    userId: string,
    reason?: string,
  ): Promise<void>;
  /** Returns true when both users share at least one assigned project. */
  hasSharedProduct(userId1: string, userId2: string): Promise<boolean>;
  /** Returns other authors who share at least one project with userId, with per-project stats. */
  getCrossAuthors(
    reportId: string,
    userId: string,
  ): Promise<
    {
      projectId: string;
      projectName: string;
      authorId: string;
      authorName: string;
      stageNames: string[];
      itemCount: number;
      riskCount: number;
    }[]
  >;
}

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

    // Create a version snapshot before overwriting
    await this.repository.createVersionSnapshot(targetSectionId);
    const copiedItems = await this.repository.fillFromSection(
      targetSectionId,
      sourceSectionId,
    );

    return { success: true, copiedItems };
  }

  /** API-08: List version snapshots for a section. */
  async listVersions(
    sectionId: string,
    userId: string,
  ): Promise<VersionSnapshot[]> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new LeadFormDomainError(`Section ${sectionId} not found.`);
    }

    if (section.authorId !== userId) {
      throw new LeadFormAccessError(
        "Can only list versions for your own section.",
      );
    }

    return this.repository.listVersions(sectionId);
  }

  /** API-09: Restore a section to a specific version. */
  async restoreVersion(
    sectionId: string,
    version: number,
    userId: string,
  ): Promise<{ success: true; restoredVersion: number }> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    if (section.authorId !== userId) {
      throw new Error("Can only restore your own section.");
    }

    if (section.status === "submitted") {
      throw new Error("Cannot restore a submitted section.");
    }

    // Create snapshot of current state before restoring
    await this.repository.createVersionSnapshot(sectionId);
    const restoredVersion = await this.repository.restoreVersion(
      sectionId,
      version,
    );

    return { success: true, restoredVersion };
  }

  /**
   * Create an explicit version snapshot of the current section state.
   *
   * Used by:
   * - The "Save Version" button on the lead form (manual checkpoint).
   * - The autosave hook every N=10 successful saves (silent safety net).
   *
   * Validates ownership and skips when the section is submitted (locked
   * sections shouldn't accumulate snapshots — there's nothing changing).
   * Snapshot retention (50 max per section) is enforced by the repository.
   */
  async createSnapshot(
    sectionId: string,
    userId: string,
  ): Promise<{ success: true }> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    if (section.authorId !== userId) {
      throw new Error("Can only snapshot your own section.");
    }

    if (section.status === "submitted") {
      throw new Error("Cannot snapshot a submitted section.");
    }

    await this.repository.createVersionSnapshot(sectionId);
    return { success: true };
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
      itemCount: number;
      riskCount: number;
    }[]
  > {
    return this.repository.getCrossAuthors(reportId, userId);
  }
}

import type { Role, VersionSnapshot } from "@customreport/shared";

import {
  LeadFormAccessError,
  LeadFormDomainError,
  type LeadFormRepository,
} from "./lead-form-shared";

/**
 * Owns the version-history surface of the lead form: fill-from, list /
 * get version, and restore. Extracted verbatim from `LeadFormService`
 * (code-quality-modernization, Wave 3, HOT ZONE — guarded by
 * `version-snapshot.characterization.integration.test.ts`); query
 * semantics and authorization are unchanged.
 */
export class VersionHistoryService {
  constructor(private readonly repository: LeadFormRepository) {}

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
    role?: Role,
  ): Promise<VersionSnapshot[]> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new LeadFormDomainError(`Section ${sectionId} not found.`);
    }

    const isHeadLike = role === "head" || role === "admin";
    const canView =
      section.authorId === userId ||
      isHeadLike ||
      (role === "lead" &&
        (await this.repository.hasSharedProduct(userId, section.authorId)));
    if (!canView) {
      throw new LeadFormAccessError(
        "Can only list versions for your own section.",
      );
    }

    return this.repository.listVersions(sectionId);
  }

  async getVersion(
    sectionId: string,
    version: number,
    userId: string,
    role?: Role,
  ): Promise<Record<string, unknown> | null> {
    const section = await this.repository.getSectionById(sectionId);
    if (!section) {
      throw new LeadFormDomainError(`Section ${sectionId} not found.`);
    }
    const isHeadLike = role === "head" || role === "admin";
    const canView =
      section.authorId === userId ||
      isHeadLike ||
      (role === "lead" &&
        (await this.repository.hasSharedProduct(userId, section.authorId)));
    if (!canView) {
      throw new LeadFormAccessError("Access denied.");
    }
    return this.repository.getVersion(sectionId, version);
  }

  /** add-version-pin: Pin or unpin an existing version of a lead's own section. */
  async setVersionPinned(
    sectionId: string,
    version: number,
    pinned: boolean,
    userId: string,
  ): Promise<void> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new LeadFormDomainError(`Section ${sectionId} not found.`);
    }

    if (section.authorId !== userId) {
      throw new LeadFormAccessError(
        "Can only pin versions of your own section.",
      );
    }

    if (section.status === "submitted") {
      throw new LeadFormDomainError(
        "Cannot pin versions on a submitted section.",
      );
    }

    await this.repository.setVersionPinned(sectionId, version, pinned);
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
}

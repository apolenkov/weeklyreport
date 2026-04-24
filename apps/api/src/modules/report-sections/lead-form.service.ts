import type { ReportSectionReadModel, VersionSnapshot } from '@customreport/shared';

export interface LeadFormRepository {
  getSectionById(sectionId: string): Promise<ReportSectionReadModel | null>;
  getSectionForPeriod(
    reportId: string,
    userId: string,
  ): Promise<{ section: ReportSectionReadModel; readOnly: boolean } | null>;
  revokeSectionSubmission(sectionId: string, revokedBy: string): Promise<void>;
  fillFromSection(targetSectionId: string, sourceSectionId: string): Promise<number>;
  listVersions(sectionId: string): Promise<VersionSnapshot[]>;
  restoreVersion(sectionId: string, version: number): Promise<number>;
  createVersionSnapshot(sectionId: string): Promise<void>;
  createReopenRequest(sectionId: string, userId: string, reason?: string): Promise<void>;
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

    if (section.status !== 'submitted') {
      throw new Error('Only submitted sections can be revoked.');
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
      throw new Error('Can only fill your own section.');
    }

    if (target.status === 'submitted') {
      throw new Error('Cannot fill a submitted section.');
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
  async listVersions(sectionId: string): Promise<VersionSnapshot[]> {
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
      throw new Error('Can only restore your own section.');
    }

    if (section.status === 'submitted') {
      throw new Error('Cannot restore a submitted section.');
    }

    // Create snapshot of current state before restoring
    await this.repository.createVersionSnapshot(sectionId);
    const restoredVersion = await this.repository.restoreVersion(sectionId, version);

    return { success: true, restoredVersion };
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
      throw new Error('Can only request reopen for your own section.');
    }

    if (section.status !== 'submitted') {
      throw new Error('Only submitted sections can request reopen.');
    }

    await this.repository.createReopenRequest(sectionId, userId, reason);
    return { success: true };
  }

  /** API-10: Get lead form for a specific period. */
  async getByPeriod(
    reportId: string,
    userId: string,
  ): Promise<{ section: ReportSectionReadModel; readOnly: boolean }> {
    const result = await this.repository.getSectionForPeriod(reportId, userId);

    if (!result) {
      throw new Error(`No section found for user in report ${reportId}.`);
    }

    return result;
  }
}

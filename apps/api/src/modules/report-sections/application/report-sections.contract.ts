import type {
  AuthorReportSectionReadModel,
  DraftSaveValidationError,
  IncompleteRecordDeletion,
  MyHistoryResult,
  PeriodStatus,
  PublishedLineage,
  ReportStatus,
} from "@weeklyreport/shared";

export class ReportSectionDomainError extends Error {
  constructor(
    readonly code: DraftSaveValidationError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ReportSectionDomainError";
  }
}

export class ReportSectionAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportSectionAccessError";
  }
}

// Kept distinct from ReportSectionDomainError so the transport mapper returns
// NOT_FOUND instead of a validation error.
export class ReportSectionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportSectionNotFoundError";
  }
}

// A concurrent writer advanced or removed the expected section version.
export class SectionVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SectionVersionConflictError";
  }
}

export interface ReportPeriodWriteGate {
  periodStatus: PeriodStatus;
  archived: boolean;
}

/** Which risks and decisions a section read carries. */
export type SectionReadScope = "complete" | "author";

export interface ReportSectionsRepository {
  // "complete", the default, hides incomplete risks and decisions and is the
  // only scope a reader other than the section author may be served. "author"
  // also carries the author's private incomplete drafts.
  getSectionById(
    reportSectionId: string,
    scope?: SectionReadScope,
  ): Promise<AuthorReportSectionReadModel | null>;
  getReportPeriodWriteGateForSection(
    sectionId: string,
  ): Promise<ReportPeriodWriteGate | null>;
  getReportMeta(
    reportId: string,
  ): Promise<{ status: ReportStatus; deadline: Date | null } | null>;
  getPublishedLineage(
    section: AuthorReportSectionReadModel,
  ): Promise<PublishedLineage>;
  // Replaces the section's children. A stored incomplete risk or decision
  // leaves only through `deletions`, and a save that names none deletes none:
  // omitting the argument can never erase a draft. The result is the author's
  // own view.
  saveSection(
    section: AuthorReportSectionReadModel,
    expectedVersion: number,
    deletions?: readonly IncompleteRecordDeletion[],
  ): Promise<AuthorReportSectionReadModel>;
  getMyHistoryPage(
    authorId: string,
    pagination: { cursor?: string | undefined; limit: number },
  ): Promise<MyHistoryResult>;
}

export const REPORT_SECTIONS_REPOSITORY = Symbol("ReportSectionsRepository");

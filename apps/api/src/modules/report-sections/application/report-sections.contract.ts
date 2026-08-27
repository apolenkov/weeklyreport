import type {
  DraftSaveValidationError,
  PeriodStatus,
  ReportSectionReadModel,
  ReportStatus,
} from "@customreport/shared";

import type { MyHistorySectionRow } from "../domain/my-history.js";

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

export interface ReportSectionsRepository {
  getSectionById(
    reportSectionId: string,
  ): Promise<ReportSectionReadModel | null>;
  getReportPeriodWriteGateForSection(
    sectionId: string,
  ): Promise<ReportPeriodWriteGate | null>;
  getReportMeta(
    reportId: string,
  ): Promise<{ status: ReportStatus; deadline: Date | null } | null>;
  getPublishedLineage(section: ReportSectionReadModel): Promise<{
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  }>;
  saveSection(
    section: ReportSectionReadModel,
    expectedVersion: number,
  ): Promise<ReportSectionReadModel>;
  getMyHistoryRows(authorId: string): Promise<readonly MyHistorySectionRow[]>;
}

export const REPORT_SECTIONS_REPOSITORY = Symbol("ReportSectionsRepository");

export type GetGraceSettings = () => Promise<{
  gracePeriodHours: number;
  allowLateSubmissions: boolean;
}>;

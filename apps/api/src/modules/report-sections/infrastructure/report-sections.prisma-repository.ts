import { Inject, Injectable } from "@nestjs/common";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "@weeklyreport/report-persistence";
import {
  type PublishedLineage,
  type ReportSectionReadModel,
  type ReportStatus,
} from "@weeklyreport/shared";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import {
  type ReportPeriodWriteGate,
  ReportSectionDomainError,
  type ReportSectionsRepository,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import {
  publishedLineageCandidates,
  queryPublishedLineage,
} from "./published-lineage.query.js";
import { queryMyHistoryPage } from "./report-sections.my-history-query.js";
import { applySaveSection } from "./save-section.transaction";

// A section save rewrites every child table (project/stage/activity statuses,
// items, risks, decisions) in one interactive transaction, which outgrows
// Prisma's default budget on the largest sections.
const SAVE_SECTION_TX_TIMEOUT_MS = 15_000;

// The save transaction's child tables (ProjectStatus, StageStatus,
// ActivityStatus, Item, Risk, Decision) are the only tables whose unique
// constraints a malformed payload can trip. Scope the P2002 check to exactly
// those constraints so a P2002 from any other constraint re-throws as an
// internal bug instead of being masked as a friendly duplicate-row 400.
const CHILD_UNIQUE_COLUMN_SETS = [
  ["reportSectionId", "projectId"],
  ["reportSectionId", "activityId"],
  ["reportSectionId", "stableId"],
] as const;

function isChildRowDuplicate(error: unknown): boolean {
  return CHILD_UNIQUE_COLUMN_SETS.some((columns) =>
    isUniqueViolation(error, { columns }),
  );
}

@Injectable()
export class ReportSectionsPrismaRepository implements ReportSectionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Selects periodStatus and archived together so reopened reports remain
  // distinguishable while archives fail closed in application prechecks.
  async getReportPeriodWriteGateForSection(
    sectionId: string,
  ): Promise<ReportPeriodWriteGate | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      select: { report: { select: { periodStatus: true, archived: true } } },
    });
    return row?.report ?? null;
  }

  // Post-save metadata for best-effort submission latency telemetry.
  async getReportMeta(
    reportId: string,
  ): Promise<{ status: ReportStatus; deadline: Date | null } | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true, deadline: true },
    });

    return report ?? null;
  }

  async getSectionById(
    reportSectionId: string,
  ): Promise<ReportSectionReadModel | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: reportSectionId },
      include: reportSectionFullInclude,
    });

    if (!row) {
      return null;
    }

    return mapPrismaToReportSection(row);
  }

  // Reference set for the resolve-not-delete lock comes from immutable
  // published snapshots and their search documents.
  getPublishedLineage(
    section: ReportSectionReadModel,
  ): Promise<PublishedLineage> {
    return queryPublishedLineage(
      this.prisma,
      publishedLineageCandidates(section),
    );
  }

  async saveSection(
    section: ReportSectionReadModel,
    expectedVersion: number,
  ): Promise<ReportSectionReadModel> {
    try {
      return await this.prisma.$transaction(
        (tx) => applySaveSection(tx, section, expectedVersion),
        { timeout: SAVE_SECTION_TX_TIMEOUT_MS },
      );
    } catch (error) {
      if (error instanceof SectionVersionConflictError) {
        throw error;
      }
      // A duplicate (reportSectionId, X) in a malformed payload trips a child
      // table's unique constraint — surface it as a clean 400. Any other P2002
      // (a constraint outside the child set) re-throws: masking it as a
      // duplicate-row 400 would hide a real invariant bug.
      if (isChildRowDuplicate(error)) {
        throw new ReportSectionDomainError(
          "DUPLICATE_CHILD_ROW",
          "Could not save the section: a duplicate row was rejected.",
        );
      }
      throw error;
    }
  }

  getMyHistoryPage(
    authorId: string,
    pagination: { cursor?: string | undefined; limit: number },
  ) {
    return queryMyHistoryPage(this.prisma, authorId, pagination);
  }
}

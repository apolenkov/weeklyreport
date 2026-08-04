import {
  type PeriodStatus,
  type ReportSectionReadModel,
  type ReportStatus,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import {
  ReportSectionDomainError,
  type ReportSectionsRepository,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import type { MyHistorySectionRow } from "../domain/my-history.js";
import { queryPublishedLineage } from "./published-lineage.query.js";
import { reportSectionFullInclude } from "./report-sections.include";
import { mapPrismaToReportSection } from "./report-sections.mappers";
import { queryMyHistoryRows } from "./report-sections.my-history-query.js";
import { applySaveSection } from "./save-section.transaction";

// A section save rewrites every child table (project/stage/activity statuses,
// items, risks, decisions) in one interactive transaction, which outgrows
// Prisma's default budget on the largest sections.
const SAVE_SECTION_TX_TIMEOUT_MS = 15_000;

// The save transaction's child tables (ProjectStatus, StageStatus,
// ActivityStatus, Item, Risk, Decision) are the only tables whose unique
// constraints a malformed payload can trip. Scope the P2002 check to exactly
// those constraints so a P2002 from any other row this transaction touches
// (a future constraint) re-throws as an internal bug instead of being masked
// as a friendly duplicate-row 400.
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

  // Selects `report.periodStatus`, not the legacy `Report.status` column that
  // reopen leaves at `published`, so the reopen-editable states (`open` /
  // `reopened`) stay distinguishable for both write-path gates.
  async getReportPeriodStatusForSection(
    sectionId: string,
  ): Promise<PeriodStatus | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      select: { report: { select: { periodStatus: true } } },
    });
    return row?.report.periodStatus ?? null;
  }

  // Null (rather than a throw) on a missing report lets the submitSection
  // grace-period gate no-op without ad-hoc try/catch.
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

  // Reference set for the resolve-not-delete lock: the union of this report's
  // frozen `publishedSnapshot` (reopened period) and live rows in other frozen
  // published/archived reports (carried clone).
  getPublishedLineage(section: ReportSectionReadModel): Promise<{
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  }> {
    return queryPublishedLineage(this.prisma, {
      reportId: section.reportId,
      reportSectionId: section.reportSectionId,
      itemStableIds: section.items.flatMap((item) =>
        item.stableId ? [item.stableId] : [],
      ),
      decisionStableIds: section.decisions.flatMap((decision) =>
        decision.stableId ? [decision.stableId] : [],
      ),
    });
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

  getMyHistoryRows(authorId: string): Promise<readonly MyHistorySectionRow[]> {
    return queryMyHistoryRows(this.prisma, authorId);
  }
}

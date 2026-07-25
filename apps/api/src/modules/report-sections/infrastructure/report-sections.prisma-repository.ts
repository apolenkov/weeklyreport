import {
  type PeriodStatus,
  type ReportSectionReadModel,
  type ReportStatus,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

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

@Injectable()
export class ReportSectionsPrismaRepository implements ReportSectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Canonical period status of the section's report, keyed on the section id —
   * the single lookup both write-path gates read. Selects `report.periodStatus`
   * so the reopen-editable states (`open` / `reopened`) are distinguished from
   * the legacy `Report.status` column, which reopen leaves at `published`.
   */
  async getReportPeriodStatusForSection(
    sectionId: string,
  ): Promise<PeriodStatus | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      select: { report: { select: { periodStatus: true } } },
    });
    return row?.report.periodStatus ?? null;
  }

  /**
   * Deadline-aware report lookup used by the submitSection grace-period gate.
   * Returns null when the report does not exist so the service can no-op the
   * gate without ad-hoc try/catch.
   */
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

  /**
   * Published lineage of the section's CURRENT rows (items + decisions) — the
   * resolve-not-delete lock's reference set. Delegates to
   * `queryPublishedLineage`, which unions the own report's frozen
   * `publishedSnapshot` (the reopened-period case) with live rows in other
   * frozen published/archived reports (the carried-clone case).
   */
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
        { timeout: 15_000 },
      );
    } catch (error) {
      if (error instanceof SectionVersionConflictError) {
        throw error;
      }
      // The DB mints child ids now, but a duplicate (reportSectionId, projectId)
      // ProjectStatus (or any other unique violation) in a malformed payload can
      // still trip P2002 — surface it as a clean 400, never an unhandled 500.
      if (isUniqueViolation(error)) {
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

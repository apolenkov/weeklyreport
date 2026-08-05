import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { parsePublishedSnapshot } from "../../publication/index.js";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../../report-sections/index.js";
import type { ReportSearchRepository } from "../application/report-search.repository.js";
import type { SelectableReportSource } from "../domain/period-source-selection.js";
import type { ReportOccurrence } from "../domain/report-retrieval.types.js";

interface ReportSourceRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodStatus: "open" | "published" | "reopened";
  readonly weekLabel: string | null;
  readonly archived: boolean;
  readonly publishedSnapshot: Prisma.JsonValue | null;
}

type EditableStatus = "open" | "reopened";
const ISO_DATE_LENGTH = 10;

function isEditableStatus(
  status: ReportSourceRow["periodStatus"],
): status is EditableStatus {
  return status === "open" || status === "reopened";
}

function periodLabel(row: Pick<ReportSourceRow, "periodStart" | "weekLabel">) {
  return (
    row.weekLabel ?? row.periodStart.toISOString().slice(0, ISO_DATE_LENGTH)
  );
}

function toSource(row: ReportSourceRow): SelectableReportSource | null {
  if (!row.archived && isEditableStatus(row.periodStatus)) {
    return {
      reportId: row.id,
      periodId: row.id,
      periodLabel: periodLabel(row),
      periodStart: row.periodStart,
      periodStatus: row.periodStatus,
      source: "live",
    };
  }

  return row.periodStatus === "published" && row.publishedSnapshot !== null
    ? {
        reportId: row.id,
        periodId: row.id,
        periodLabel: periodLabel(row),
        periodStart: row.periodStart,
        periodStatus: row.periodStatus,
        source: "snapshot",
      }
    : null;
}

function toOccurrence(
  source: SelectableReportSource,
  sections: ReportOccurrence["sections"],
): ReportOccurrence {
  return {
    reportId: source.reportId,
    periodId: source.periodId,
    periodLabel: source.periodLabel,
    periodStart: source.periodStart,
    source: source.source,
    sections,
  };
}

@Injectable()
export class ReportSearchPrismaRepository implements ReportSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listSources(): Promise<readonly SelectableReportSource[]> {
    const rows = await this.prisma.report.findMany({
      select: {
        id: true,
        periodStart: true,
        periodStatus: true,
        weekLabel: true,
        archived: true,
        publishedSnapshot: true,
      },
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    });

    return rows
      .map((row) => toSource(row))
      .filter((source): source is SelectableReportSource => source !== null);
  }

  async hasOwnSection(reportId: string, actorId: string): Promise<boolean> {
    const section = await this.prisma.reportSection.findUnique({
      where: { reportId_authorId: { reportId, authorId: actorId } },
      select: { id: true },
    });
    return section !== null;
  }

  async getSharedNonArchivedProductIds(
    actorId: string,
    authorId: string,
  ): Promise<readonly string[]> {
    const rows = await this.prisma.stageAssignment.findMany({
      where: {
        userId: authorId,
        project: {
          archived: false,
          stageAssignments: { some: { userId: actorId } },
        },
      },
      select: { projectId: true },
    });
    return [...new Set(rows.map((row) => row.projectId))];
  }

  async loadOccurrences(
    sources: readonly SelectableReportSource[],
  ): Promise<readonly ReportOccurrence[]> {
    const occurrences = await Promise.all(
      sources.map((source) => this.loadOccurrence(source)),
    );
    return occurrences.filter(
      (occurrence): occurrence is ReportOccurrence => occurrence !== null,
    );
  }

  private async loadOccurrence(
    source: SelectableReportSource,
  ): Promise<ReportOccurrence | null> {
    return source.source === "live"
      ? this.loadLiveOccurrence(source)
      : this.loadSnapshotOccurrence(source);
  }

  private async loadLiveOccurrence(
    source: SelectableReportSource,
  ): Promise<ReportOccurrence | null> {
    const report = await this.prisma.report.findUnique({
      where: {
        id: source.reportId,
        periodStatus: source.periodStatus,
        archived: false,
      },
      include: {
        sections: {
          include: reportSectionFullInclude,
          orderBy: [{ author: { name: "asc" } }, { id: "asc" }],
        },
      },
    });

    return report
      ? toOccurrence(source, report.sections.map(mapPrismaToReportSection))
      : null;
  }

  private async loadSnapshotOccurrence(
    source: SelectableReportSource,
  ): Promise<ReportOccurrence | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: source.reportId, periodStatus: "published" },
      select: {
        id: true,
        publishedSnapshot: true,
      },
    });
    const snapshot = parsePublishedSnapshot(report?.publishedSnapshot);

    return snapshot?.reportId === source.reportId
      ? toOccurrence(source, snapshot.sections)
      : null;
  }
}

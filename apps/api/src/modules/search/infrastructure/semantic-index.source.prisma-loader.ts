import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { parsePublishedSnapshot } from "../../publication/index.js";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../../report-sections/index.js";
import type {
  SemanticIndexLocator,
  SemanticIndexSourceLoader,
} from "../application/semantic-index.source-loader.js";
import { projectSectionCandidates } from "../domain/candidate-projector.js";
import type {
  ReportOccurrence,
  SearchCandidate,
  SectionScope,
} from "../domain/report-retrieval.types.js";

interface ReportRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodStatus: "open" | "published" | "reopened";
  readonly weekLabel: string | null;
  readonly archived: boolean;
  readonly publishedSnapshot: Prisma.JsonValue | null;
}

const ISO_DATE_LENGTH = 10;

const periodLabel = (
  row: Pick<ReportRow, "periodStart" | "weekLabel">,
): string =>
  row.weekLabel ?? row.periodStart.toISOString().slice(0, ISO_DATE_LENGTH);

const occurrence = (
  report: ReportRow,
  source: ReportOccurrence["source"],
  section: ReportOccurrence["sections"][number],
): ReportOccurrence => ({
  reportId: report.id,
  periodId: report.id,
  periodLabel: periodLabel(report),
  periodStart: report.periodStart,
  source,
  sections: [section],
});

const scopeFor = (
  occurrenceValue: ReportOccurrence,
  section: ReportOccurrence["sections"][number],
): SectionScope => ({
  reportId: occurrenceValue.reportId,
  sectionId: section.reportSectionId,
  authorId: section.authorId,
  visibility: "own",
  section,
});

const matchesLocator = (
  candidate: SearchCandidate,
  locator: SemanticIndexLocator,
): boolean =>
  candidate.kind === locator.recordKind &&
  candidate.identity.recordId === locator.recordId &&
  candidate.identity.occurrenceId === locator.occurrenceId;

@Injectable()
export class SemanticIndexPrismaSourceLoader implements SemanticIndexSourceLoader {
  constructor(private readonly prisma: PrismaService) {}

  async load(locator: SemanticIndexLocator): Promise<SearchCandidate | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: locator.reportId },
      select: {
        id: true,
        periodStart: true,
        periodStatus: true,
        weekLabel: true,
        archived: true,
        publishedSnapshot: true,
      },
    });
    if (!report) return null;
    const row = report as ReportRow;
    return locator.source === "live"
      ? this.loadLiveCandidate(locator, row)
      : this.loadSnapshotCandidate(locator, row);
  }

  private async loadLiveCandidate(
    locator: SemanticIndexLocator,
    report: ReportRow,
  ): Promise<SearchCandidate | null> {
    if (
      report.archived ||
      (report.periodStatus !== "open" && report.periodStatus !== "reopened")
    ) {
      return null;
    }
    const sectionRow = await this.prisma.reportSection.findUnique({
      where: { id: locator.sectionId },
      include: reportSectionFullInclude,
    });
    const section = sectionRow ? mapPrismaToReportSection(sectionRow) : null;
    return section?.reportId === report.id
      ? this.findCandidate(
          occurrence(report, "live", section),
          section,
          locator,
        )
      : null;
  }

  private loadSnapshotCandidate(
    locator: SemanticIndexLocator,
    report: ReportRow,
  ): SearchCandidate | null {
    if (report.archived || report.periodStatus !== "published") return null;
    const snapshot = parsePublishedSnapshot(report.publishedSnapshot);
    const section =
      snapshot?.reportId === report.id
        ? snapshot.sections.find(
            ({ reportSectionId }) => reportSectionId === locator.sectionId,
          )
        : undefined;
    return section
      ? this.findCandidate(
          occurrence(report, "snapshot", section),
          section,
          locator,
        )
      : null;
  }

  private findCandidate(
    report: ReportOccurrence,
    section: ReportOccurrence["sections"][number],
    locator: SemanticIndexLocator,
  ): SearchCandidate | null {
    const scope = scopeFor(report, section);
    return (
      projectSectionCandidates(report, scope).find((candidate) =>
        matchesLocator(candidate, locator),
      ) ?? null
    );
  }
}

import { Inject, Injectable } from "@nestjs/common";
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
  readonly status: "draft" | "published";
  readonly periodStatus: "open" | "published" | "reopened";
  readonly periodState: "scheduled" | "open" | "published" | "archived";
  readonly weekLabel: string | null;
  readonly archived: boolean;
  readonly publishedSnapshot: Prisma.JsonValue | null;
}

const ISO_DATE_LENGTH = 10;

const reportSelect = {
  id: true,
  periodStart: true,
  status: true,
  periodStatus: true,
  periodState: true,
  weekLabel: true,
  archived: true,
  publishedSnapshot: true,
} as const;

const isLiveLifecycle = (report: ReportRow): boolean =>
  !report.archived &&
  report.periodState === "open" &&
  ((report.status === "draft" && report.periodStatus === "open") ||
    (report.status === "published" && report.periodStatus === "reopened"));

const isPublishedSnapshotLifecycle = (report: ReportRow): boolean =>
  report.status === "published" &&
  report.periodStatus === "published" &&
  ((report.periodState === "published" && !report.archived) ||
    (report.periodState === "archived" && report.archived));

const sameSnapshot = (
  left: Prisma.JsonValue | null,
  right: Prisma.JsonValue | null,
): boolean => JSON.stringify(left) === JSON.stringify(right);

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(locator: SemanticIndexLocator): Promise<SearchCandidate | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: locator.reportId },
      select: reportSelect,
    });
    if (!report) return null;
    return locator.source === "live"
      ? this.loadLiveCandidate(locator, report)
      : this.loadSnapshotCandidate(locator, report);
  }

  private async loadLiveCandidate(
    locator: SemanticIndexLocator,
    report: ReportRow,
  ): Promise<SearchCandidate | null> {
    if (!isLiveLifecycle(report)) {
      return null;
    }
    const sectionRow = await this.prisma.reportSection.findUnique({
      where: { id: locator.sectionId },
      include: reportSectionFullInclude,
    });
    const section = sectionRow ? mapPrismaToReportSection(sectionRow) : null;
    if (section?.reportId !== report.id) return null;

    // Re-read the lifecycle after loading the mutable section. A publish,
    // reopen, or archive racing this read must invalidate the candidate.
    const current = await this.prisma.report.findUnique({
      where: { id: report.id },
      select: reportSelect,
    });
    if (!current || !isLiveLifecycle(current)) return null;

    return this.findCandidate(
      occurrence(current, "live", section),
      section,
      locator,
    );
  }

  private async loadSnapshotCandidate(
    locator: SemanticIndexLocator,
    report: ReportRow,
  ): Promise<SearchCandidate | null> {
    if (!isPublishedSnapshotLifecycle(report)) return null;
    const snapshot = (() => {
      try {
        return parsePublishedSnapshot(report.publishedSnapshot);
      } catch {
        return null;
      }
    })();
    const section =
      snapshot?.reportId === report.id
        ? snapshot.sections.find(
            ({ reportSectionId }) => reportSectionId === locator.sectionId,
          )
        : undefined;
    if (!section) return null;

    // The published payload is immutable for this source. Re-read both the
    // lifecycle tuple and payload so a concurrent republish/archive cannot
    // return a candidate from a stale snapshot.
    const current = await this.prisma.report.findUnique({
      where: { id: report.id },
      select: reportSelect,
    });
    const currentRow = current;
    if (
      !currentRow ||
      !isPublishedSnapshotLifecycle(currentRow) ||
      !sameSnapshot(currentRow.publishedSnapshot, report.publishedSnapshot)
    ) {
      return null;
    }
    return this.findCandidate(
      occurrence(currentRow, "snapshot", section),
      section,
      locator,
    );
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

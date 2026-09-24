import { MAX_PUBLISHED_PERIODS } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { parsePublishedSnapshot } from "../../publication/index.js";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../../report-sections/index.js";
import {
  type ReportSearchRepository,
  ReportSearchResultSetTooLargeError,
  type ReportSourceOptions,
} from "../application/report-search.repository.js";
import { normalizeEntityReference } from "../domain/entity-alias-index.js";
import type { SelectableReportSource } from "../domain/period-source-selection.js";
import type { ReportOccurrence } from "../domain/report-retrieval.types.js";
interface ReportSourceRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly status: "draft" | "published";
  readonly periodStatus: "open" | "published" | "reopened";
  readonly periodState: "scheduled" | "open" | "published" | "archived";
  readonly weekLabel: string | null;
  readonly archived: boolean;
  readonly publishedSnapshot: Prisma.JsonValue | null;
}
const DEFAULT_PUBLISHED_COUNT = 3;
const ISO_DATE_LENGTH = 10;
const LIVE_REPORT_LIFECYCLE_WHERE = {
  archived: false,
  periodState: "open",
  OR: [
    { status: "draft", periodStatus: "open" },
    { status: "published", periodStatus: "reopened" },
  ],
} satisfies Prisma.ReportWhereInput;
const PUBLISHED_REPORT_LIFECYCLE_WHERE = {
  status: "published",
  periodStatus: "published",
  OR: [
    { archived: false, periodState: "published" },
    { archived: true, periodState: "archived" },
  ],
} satisfies Prisma.ReportWhereInput;
const periodLabel = (
  row: Pick<ReportSourceRow, "periodStart" | "weekLabel">,
): string =>
  row.weekLabel ?? row.periodStart.toISOString().slice(0, ISO_DATE_LENGTH);
function toSource(row: ReportSourceRow): SelectableReportSource | null {
  const isLiveDraft =
    row.status === "draft" &&
    row.periodStatus === "open" &&
    row.periodState === "open" &&
    !row.archived;
  const isLiveReopened =
    row.status === "published" &&
    row.periodStatus === "reopened" &&
    row.periodState === "open" &&
    !row.archived;
  if (isLiveDraft || isLiveReopened) {
    return {
      reportId: row.id,
      periodId: row.id,
      periodLabel: periodLabel(row),
      periodStart: row.periodStart,
      periodStatus: row.periodStatus,
      source: "live",
    };
  }
  const isPublishedSnapshot =
    row.status === "published" &&
    row.periodStatus === "published" &&
    ((row.periodState === "published" && !row.archived) ||
      (row.periodState === "archived" && row.archived)) &&
    row.publishedSnapshot !== null;
  return isPublishedSnapshot
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async getSourceGeneration(): Promise<bigint> {
    const state = await this.prisma.semanticSourceState.findUnique({
      where: { id: "singleton" },
      select: { generation: true },
    });
    if (!state)
      throw new Error("Semantic source generation is not initialized");
    return state.generation;
  }
  async listSources(
    options: ReportSourceOptions = {},
  ): Promise<readonly SelectableReportSource[]> {
    const mode = options.publishedMode ?? "latest";
    const requestedCount = options.publishedCount ?? DEFAULT_PUBLISHED_COUNT;
    if (requestedCount < 0 || requestedCount > MAX_PUBLISHED_PERIODS) {
      throw new ReportSearchResultSetTooLargeError();
    }
    const publishedTake =
      mode === "all" || mode === "named"
        ? MAX_PUBLISHED_PERIODS + 1
        : requestedCount;
    const currentRows = await this.prisma.report.findMany({
      where: LIVE_REPORT_LIFECYCLE_WHERE,
      select: {
        id: true,
        periodStart: true,
        status: true,
        periodStatus: true,
        periodState: true,
        weekLabel: true,
        archived: true,
      },
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    });
    const publishedRows =
      mode === "none"
        ? []
        : await this.prisma.report.findMany({
            where: {
              ...PUBLISHED_REPORT_LIFECYCLE_WHERE,
            },
            select: {
              id: true,
              periodStart: true,
              status: true,
              periodStatus: true,
              periodState: true,
              weekLabel: true,
              archived: true,
            },
            orderBy: [{ periodStart: "desc" }, { id: "desc" }],
            take: publishedTake,
          });
    if (
      (mode === "all" || mode === "named") &&
      publishedRows.length > MAX_PUBLISHED_PERIODS
    ) {
      throw new ReportSearchResultSetTooLargeError();
    }
    const namedLabels = options.publishedLabels;
    const namedRows =
      mode === "named" && namedLabels
        ? publishedRows.filter((row) =>
            namedLabels.some(
              (label) =>
                normalizeEntityReference(label) ===
                normalizeEntityReference(periodLabel(row)),
            ),
          )
        : publishedRows;
    const metadataRows = [...currentRows, ...namedRows];
    const publishedIds = namedRows.map((row) => row.id);
    const snapshots =
      publishedIds.length > 0
        ? await this.prisma.report.findMany({
            where: {
              id: { in: publishedIds },
              ...PUBLISHED_REPORT_LIFECYCLE_WHERE,
            },
            select: { id: true, publishedSnapshot: true },
          })
        : [];
    const snapshotById = new Map(
      snapshots.map((row) => [row.id, row.publishedSnapshot]),
    );
    return metadataRows
      .map((row) =>
        toSource({
          ...row,
          publishedSnapshot:
            row.periodStatus === "published"
              ? (snapshotById.get(row.id) ?? null)
              : null,
        }),
      )
      .filter((source): source is SelectableReportSource => source !== null);
  }
  async getAuthorizationSnapshot(
    actorId: string,
    reportIds: readonly string[],
    authorIds: readonly string[],
  ): Promise<{
    readonly ownSectionReportIds: readonly string[];
    readonly sharedProductIdsByAuthor: ReadonlyMap<string, readonly string[]>;
  }> {
    return this.prisma.$transaction(
      async (tx) => {
        const ownSections = await tx.reportSection.findMany({
          where: { reportId: { in: [...reportIds] }, authorId: actorId },
          select: { reportId: true },
        });
        const sharedRows =
          authorIds.length > 0
            ? await tx.stageAssignment.findMany({
                where: {
                  userId: { in: [...authorIds] },
                  project: {
                    archived: false,
                    stageAssignments: { some: { userId: actorId } },
                  },
                },
                select: { userId: true, projectId: true },
              })
            : [];
        const grouped = new Map<string, Set<string>>();
        for (const row of sharedRows) {
          const productIds = grouped.get(row.userId) ?? new Set<string>();
          productIds.add(row.projectId);
          grouped.set(row.userId, productIds);
        }
        return {
          ownSectionReportIds: ownSections.map((row) => row.reportId),
          sharedProductIdsByAuthor: new Map(
            [...grouped].map(([authorId, ids]) => [authorId, [...ids]]),
          ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
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
        ...LIVE_REPORT_LIFECYCLE_WHERE,
        periodStatus: source.periodStatus,
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
      where: {
        id: source.reportId,
        ...PUBLISHED_REPORT_LIFECYCLE_WHERE,
      },
      select: { publishedSnapshot: true },
    });
    const snapshot = parsePublishedSnapshot(report?.publishedSnapshot);
    return snapshot?.reportId === source.reportId
      ? toOccurrence(source, snapshot.sections)
      : null;
  }
}

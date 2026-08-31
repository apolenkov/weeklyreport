import { requirePublishedSnapshot } from "@customreport/report-persistence";
import type {
  MyHistoryResult,
  PublishedReportSectionReadModel,
} from "@customreport/shared";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { ReportSectionDomainError } from "../application/report-sections.contract.js";
import {
  buildMyHistoryEntries,
  type MyHistorySectionRow,
} from "../domain/my-history.js";
import { requireScopedPublishedSnapshot } from "./published-report-scope.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface HistoryCursor {
  periodStart: Date;
  eventAt: Date;
  source: "live" | "published";
  id: string;
}
type HistoryCandidate = MyHistorySectionRow & {
  readonly cursorSource: "live" | "published";
  readonly cursorId: string;
};

function encodeCursor(value: HistoryCursor): string {
  return Buffer.from(
    JSON.stringify({
      periodStart: value.periodStart.toISOString(),
      eventAt: value.eventAt.toISOString(),
      source: value.source,
      id: value.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeMyHistoryCursor(cursor: string): HistoryCursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("periodStart" in parsed) ||
      !("eventAt" in parsed) ||
      !("source" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.periodStart !== "string" ||
      typeof parsed.eventAt !== "string" ||
      !(parsed.source === "live" || parsed.source === "published") ||
      typeof parsed.id !== "string" ||
      !UUID_RE.test(parsed.id)
    )
      throw new Error("invalid cursor");
    const periodStart = new Date(parsed.periodStart);
    const eventAt = new Date(parsed.eventAt);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(eventAt.getTime()))
      throw new Error("invalid cursor");
    const source = parsed.source === "published" ? "published" : "live";
    return { periodStart, eventAt, source, id: parsed.id };
  } catch {
    throw new ReportSectionDomainError(
      "INVALID_HISTORY_CURSOR",
      "Invalid my-history cursor.",
    );
  }
}

function keysetWhere(
  cursor: HistoryCursor | undefined,
): Prisma.ReportSectionWhereInput {
  if (!cursor) return {};
  const samePeriod = { report: { periodStart: cursor.periodStart } };
  return {
    OR: [
      { report: { periodStart: { lt: cursor.periodStart } } },
      { ...samePeriod, createdAt: { lt: cursor.eventAt } },
      ...(cursor.source === "published"
        ? [{ ...samePeriod, createdAt: cursor.eventAt }]
        : [
            { ...samePeriod, createdAt: cursor.eventAt, id: { lt: cursor.id } },
          ]),
    ],
  };
}

function publishedKeysetWhere(
  cursor: HistoryCursor | undefined,
): Prisma.ReportWhereInput {
  if (!cursor) return {};
  return {
    OR: [
      { periodStart: { lt: cursor.periodStart } },
      { periodStart: cursor.periodStart, publishedAt: { lt: cursor.eventAt } },
      ...(cursor.source === "live"
        ? []
        : [
            {
              periodStart: cursor.periodStart,
              publishedAt: cursor.eventAt,
              id: { lt: cursor.id },
            },
          ]),
    ],
  };
}

function publishedStageStatusRows(
  project: PublishedReportSectionReadModel["projects"][number],
  timestamp: Date,
) {
  return project.ownedStages.map(() => ({
    projectId: project.projectId,
    updatedAt: timestamp,
  }));
}

function publishedHistoryRows(
  rows: readonly {
    readonly id: string;
    readonly archived: boolean;
    readonly publishedSnapshot: Prisma.JsonValue | null;
  }[],
  authorId: string,
): HistoryCandidate[] {
  return rows.flatMap((report) => {
    const snapshot = requirePublishedSnapshot(
      report.publishedSnapshot,
      report.id,
    );
    const scopedSnapshot = requireScopedPublishedSnapshot(
      snapshot,
      { role: "lead", userId: authorId },
      "lead-own",
    );
    const timestamp = scopedSnapshot.publishedAt;
    return scopedSnapshot.sections.map((section) => ({
      id: section.reportSectionId,
      status: section.status,
      submittedAt: section.submittedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
      report: {
        id: snapshot.reportId,
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        status: snapshot.status,
        archived: report.archived,
        publishedAt: timestamp,
      },
      items: section.items.map((item) => ({
        projectId: item.projectId ?? null,
        updatedAt: timestamp,
        priorityRank: item.priorityRank ?? null,
      })),
      risks: section.risks.map((risk) => ({
        projectId: risk.projectId ?? null,
        updatedAt: timestamp,
      })),
      decisions: section.decisions.map((decision) => ({
        productId: decision.productId ?? null,
        updatedAt: timestamp,
      })),
      projectStatuses: section.projects.map((project) => ({
        projectId: project.projectId,
        status: project.trafficLight,
        updatedAt: timestamp,
      })),
      stageStatuses: section.projects.flatMap((project) =>
        publishedStageStatusRows(project, timestamp),
      ),
      // Published rows are ordered by the owning report id in SQL; keep
      // that same coordinate for the merged keyset (section ids differ).
      cursorId: report.id,
      cursorSource: "published" as const,
    }));
  });
}

async function queryMyHistoryPageInTransaction(
  prisma: Prisma.TransactionClient,
  authorId: string,
  pagination: {
    readonly cursor?: string | undefined;
    readonly limit: number;
  },
): Promise<MyHistoryResult> {
  const { limit } = pagination;
  const cursor = pagination.cursor
    ? decodeMyHistoryCursor(pagination.cursor)
    : undefined;
  // Both source reads must share one database snapshot. Running them in
  // parallel on the root client allows a publish between statements to make
  // the merged page omit or duplicate a report (and invalidate its cursor).
  // Repeatable Read gives the cursor a stable view for the whole merge.
  const liveRows = await prisma.reportSection.findMany({
    where: {
      authorId,
      report: { periodStatus: { not: "published" } },
      ...keysetWhere(cursor),
    },
    orderBy: [
      { report: { periodStart: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: limit + 1,
    include: {
      report: {
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          archived: true,
          publishedAt: true,
        },
      },
      items: {
        select: { projectId: true, updatedAt: true, priorityRank: true },
      },
      risks: { select: { projectId: true, updatedAt: true } },
      decisions: { select: { productId: true, updatedAt: true } },
      projectStatuses: {
        select: { projectId: true, status: true, updatedAt: true },
      },
      stageStatuses: { select: { projectId: true, updatedAt: true } },
    },
  });
  const publishedReports = await prisma.report.findMany({
    where: {
      status: "published",
      periodStatus: "published",
      publishedSectionScopes: { some: { authorId } },
      publishedSnapshot: { not: Prisma.JsonNull },
      ...publishedKeysetWhere(cursor),
    },
    orderBy: [{ periodStart: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, archived: true, publishedSnapshot: true },
  });
  const candidates: HistoryCandidate[] = [
    ...liveRows.map((row) => ({
      ...row,
      cursorId: row.id,
      cursorSource: "live" as const,
    })),
    ...publishedHistoryRows(publishedReports, authorId),
  ].sort(
    (left, right) =>
      right.report.periodStart.getTime() - left.report.periodStart.getTime() ||
      right.createdAt.getTime() - left.createdAt.getTime() ||
      (right.cursorSource === "published" ? 1 : 0) -
        (left.cursorSource === "published" ? 1 : 0) ||
      right.cursorId.localeCompare(left.cursorId),
  );
  const hasMore = candidates.length > limit;
  const rows = candidates.slice(0, limit);
  const last = rows.at(-1);
  return {
    items: buildMyHistoryEntries(rows),
    nextCursor:
      hasMore && last
        ? encodeCursor({
            periodStart: last.report.periodStart,
            eventAt: last.createdAt,
            source: last.cursorSource,
            id: last.cursorId,
          })
        : null,
  };
}

export function queryMyHistoryPage(
  prisma: PrismaService,
  authorId: string,
  pagination: {
    readonly cursor?: string | undefined;
    readonly limit: number;
  },
): Promise<MyHistoryResult> {
  return prisma.$transaction(
    (tx) => queryMyHistoryPageInTransaction(tx, authorId, pagination),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

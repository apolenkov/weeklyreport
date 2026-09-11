import { PublishedSnapshotIntegrityError } from "@customreport/report-persistence";
import {
  type LeadOpenWorkHistoryOccurrence,
  leadOpenWorkHistoryOccurrenceSchema,
  type LeadOpenWorkHistoryOutput,
  leadOpenWorkHistoryOutputSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { LeadFormConstraintError } from "../domain/lead-form-shared.js";
import {
  resolveStatusOverviewPredecessor,
  type StatusOverviewPredecessorRow,
} from "./lead-form-status-overview.predecessor.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface OpenWorkCursor {
  readonly periodStart: Date;
  readonly createdAt: Date;
  readonly id: string;
}

interface OpenWorkReportRow extends StatusOverviewPredecessorRow {
  readonly createdAt: Date;
  readonly status: "draft" | "published";
  readonly periodStatus: "open" | "published" | "reopened";
}

function encodeOpenWorkCursor(value: OpenWorkCursor): string {
  return Buffer.from(
    JSON.stringify({
      periodStart: value.periodStart.toISOString(),
      createdAt: value.createdAt.toISOString(),
      id: value.id,
    }),
    "utf8",
  ).toString("base64url");
}

function parseCursorDate(value: unknown): Date {
  if (typeof value !== "string") throw new Error("invalid cursor date");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error("invalid cursor date");
  }
  return parsed;
}

/** Decodes a private report keyset without accepting partial coordinates. */
export function decodeOpenWorkCursor(cursor: string): OpenWorkCursor {
  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      value === null ||
      typeof value !== "object" ||
      !("periodStart" in value) ||
      !("createdAt" in value) ||
      !("id" in value) ||
      typeof value.id !== "string" ||
      !UUID_RE.test(value.id)
    ) {
      throw new Error("invalid cursor shape");
    }
    return {
      periodStart: parseCursorDate(value.periodStart),
      createdAt: parseCursorDate(value.createdAt),
      id: value.id,
    };
  } catch {
    throw new LeadFormConstraintError("Invalid open-work cursor.");
  }
}

function keysetWhere(
  cursor: OpenWorkCursor | undefined,
): Prisma.ReportWhereInput {
  if (!cursor) return {};
  return {
    OR: [
      { periodStart: { lt: cursor.periodStart } },
      {
        periodStart: cursor.periodStart,
        createdAt: { lt: cursor.createdAt },
      },
      {
        periodStart: cursor.periodStart,
        createdAt: cursor.createdAt,
        id: { lt: cursor.id },
      },
    ],
  };
}

function snapshotIntegrityFailure(reportId: string): never {
  throw new PublishedSnapshotIntegrityError(
    `Published snapshot integrity failure for report ${reportId}.`,
  );
}

function historicalParent(
  section: ReportSectionReadModel,
  item: ReportSectionReadModel["items"][number],
): LeadOpenWorkHistoryOccurrence["parent"] {
  if (item.projectId) {
    const name =
      section.projects.find((project) => project.projectId === item.projectId)
        ?.projectName ??
      section.referencedProjects.find(
        (project) => project.projectId === item.projectId,
      )?.projectName ??
      null;
    return { kind: "product", id: item.projectId, name };
  }
  if (item.activityId) {
    const name =
      section.activities.find(
        (activity) => activity.activityId === item.activityId,
      )?.activityName ?? null;
    return { kind: "activity", id: item.activityId, name };
  }
  throw new PublishedSnapshotIntegrityError(
    "Historical section item has no validated parent.",
  );
}

async function occurrencesForReport(
  tx: Prisma.TransactionClient,
  report: OpenWorkReportRow,
  authorId: string,
): Promise<LeadOpenWorkHistoryOccurrence[]> {
  if (
    report.publishedSnapshot === null &&
    (report.status === "published" || report.periodStatus === "published")
  ) {
    return report.publishedSectionScopes.some(
      (scope) => scope.authorId === authorId,
    )
      ? snapshotIntegrityFailure(report.id)
      : [];
  }

  const source = await resolveStatusOverviewPredecessor(
    tx,
    report,
    authorId,
    authorId,
    "lead",
  );
  if (
    source.availability === "unavailable" &&
    source.reason === "invalid_published_snapshot"
  ) {
    return snapshotIntegrityFailure(report.id);
  }
  if (
    source.availability === "available" &&
    source.source === "published" &&
    !report.publishedSectionScopes.some(
      (scope) =>
        scope.authorId === authorId &&
        scope.reportSectionId === source.section.reportSectionId,
    )
  ) {
    return snapshotIntegrityFailure(report.id);
  }
  if (
    source.availability === "unavailable" ||
    source.section.status !== "submitted"
  ) {
    return [];
  }

  return source.section.items.map((item) =>
    leadOpenWorkHistoryOccurrenceSchema.parse({
      source: source.source,
      reportId: source.reportId,
      reportSectionId: source.section.reportSectionId,
      periodStart: source.periodStart,
      periodEnd: source.periodEnd,
      parent: historicalParent(source.section, item),
      item,
    }),
  );
}

async function queryOpenWorkPageInTransaction(
  tx: Prisma.TransactionClient,
  reportId: string,
  authorId: string,
  pagination: { readonly cursor?: string | undefined; readonly limit: number },
): Promise<LeadOpenWorkHistoryOutput | null> {
  const target = await tx.report.findUnique({
    where: { id: reportId },
    select: { periodStart: true },
  });
  if (!target) return null;

  const cursor = pagination.cursor
    ? decodeOpenWorkCursor(pagination.cursor)
    : undefined;
  const candidates = await tx.report.findMany({
    where: {
      periodStart: { lt: target.periodStart },
      ...keysetWhere(cursor),
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: pagination.limit + 1,
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
      status: true,
      periodStatus: true,
      publishedSnapshot: true,
      publishedSectionScopes: {
        where: { authorId },
        select: {
          authorId: true,
          reportSectionId: true,
          groupId: true,
        },
      },
    },
  });
  const reports = candidates.slice(0, pagination.limit);
  const occurrences: LeadOpenWorkHistoryOccurrence[] = [];
  for (const report of reports) {
    occurrences.push(...(await occurrencesForReport(tx, report, authorId)));
  }
  const last = reports.at(-1);
  return leadOpenWorkHistoryOutputSchema.parse({
    occurrences,
    nextCursor:
      candidates.length > pagination.limit && last
        ? encodeOpenWorkCursor(last)
        : null,
  });
}

/** Reads one bounded page of older reports on a single repeatable snapshot. */
export function queryLeadOpenWorkPage(
  prisma: PrismaService,
  reportId: string,
  authorId: string,
  pagination: { readonly cursor?: string | undefined; readonly limit: number },
): Promise<LeadOpenWorkHistoryOutput | null> {
  return prisma.$transaction(
    (tx) => queryOpenWorkPageInTransaction(tx, reportId, authorId, pagination),
    { isolationLevel: "RepeatableRead" },
  );
}

import { PublishedSnapshotIntegrityError } from "@customreport/report-persistence";
import type { ReportSectionReadModel } from "@customreport/shared";
import { Prisma } from "@prisma/client";

import { LeadFormConstraintError } from "../domain/lead-form-shared.js";
import {
  resolveStatusOverviewPredecessor,
  type StatusOverviewPredecessorRow,
} from "./lead-form-status-overview.predecessor.js";

const REPORT_LOCK_PAGE_SIZE = 25;

export interface OutcomeSourceReportRow extends StatusOverviewPredecessorRow {
  readonly createdAt: Date;
  readonly status: "draft" | "published";
  readonly periodStatus: "open" | "published" | "reopened";
}

interface ReportCoordinate {
  readonly id: string;
  readonly periodStart: Date;
  readonly createdAt: Date;
}

function snapshotIntegrityFailure(reportId: string): never {
  throw new PublishedSnapshotIntegrityError(
    `Published snapshot integrity failure for report ${reportId}.`,
  );
}

/** Resolves one author-owned source without mutable fallback from frozen state. */
export async function resolveEligibleOutcomeSourceSection(
  tx: Prisma.TransactionClient,
  report: OutcomeSourceReportRow,
  authorId: string,
): Promise<ReportSectionReadModel | null> {
  if (
    report.publishedSnapshot === null &&
    (report.status === "published" || report.periodStatus === "published")
  ) {
    return report.publishedSectionScopes.some(
      (scope) => scope.authorId === authorId,
    )
      ? snapshotIntegrityFailure(report.id)
      : null;
  }

  const resolved = await resolveStatusOverviewPredecessor(
    tx,
    report,
    authorId,
    authorId,
    "lead",
  );
  if (
    resolved.availability === "unavailable" &&
    resolved.reason === "invalid_published_snapshot"
  ) {
    return snapshotIntegrityFailure(report.id);
  }
  if (resolved.availability === "unavailable") return null;
  if (
    resolved.source === "published" &&
    !report.publishedSectionScopes.some(
      (scope) =>
        scope.authorId === authorId &&
        scope.reportSectionId === resolved.section.reportSectionId,
    )
  ) {
    return snapshotIntegrityFailure(report.id);
  }
  return resolved.section.status === "submitted" ? resolved.section : null;
}

function afterSource(
  source: ReportCoordinate,
  targetPeriodStart: Date,
): Prisma.Sql {
  return Prisma.sql`
    report."periodStart" < ${targetPeriodStart}
    AND (
      report."periodStart" > ${source.periodStart}
      OR (
        report."periodStart" = ${source.periodStart}
        AND report."createdAt" > ${source.createdAt}
      )
      OR (
        report."periodStart" = ${source.periodStart}
        AND report."createdAt" = ${source.createdAt}
        AND report."id" > ${source.id}
      )
    )
  `;
}

function afterPage(cursor: ReportCoordinate | undefined): Prisma.Sql {
  if (!cursor) return Prisma.empty;
  return Prisma.sql`
    AND (
      report."periodStart" < ${cursor.periodStart}
      OR (
        report."periodStart" = ${cursor.periodStart}
        AND report."createdAt" < ${cursor.createdAt}
      )
      OR (
        report."periodStart" = ${cursor.periodStart}
        AND report."createdAt" = ${cursor.createdAt}
        AND report."id" < ${cursor.id}
      )
    )
  `;
}

async function lockNextReportPage(
  tx: Prisma.TransactionClient,
  source: ReportCoordinate,
  targetPeriodStart: Date,
  cursor: ReportCoordinate | undefined,
): Promise<ReportCoordinate[]> {
  return tx.$queryRaw<ReportCoordinate[]>(Prisma.sql`
    SELECT report."id", report."periodStart", report."createdAt"
    FROM "Report" report
    WHERE ${afterSource(source, targetPeriodStart)}
    ${afterPage(cursor)}
    ORDER BY
      report."periodStart" DESC,
      report."createdAt" DESC,
      report."id" DESC
    LIMIT ${REPORT_LOCK_PAGE_SIZE}
    FOR UPDATE
  `);
}

async function readLockedReports(
  tx: Prisma.TransactionClient,
  coordinates: readonly ReportCoordinate[],
  authorId: string,
): Promise<OutcomeSourceReportRow[]> {
  const rows = await tx.report.findMany({
    where: { id: { in: coordinates.map((coordinate) => coordinate.id) } },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }, { id: "desc" }],
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
        select: { authorId: true, reportSectionId: true, groupId: true },
      },
    },
  });
  if (rows.length !== coordinates.length) {
    throw new PublishedSnapshotIntegrityError(
      "Locked historical report set changed inside the transaction.",
    );
  }
  return rows;
}

interface LatestOutcomeSourceInput {
  readonly source: OutcomeSourceReportRow;
  readonly targetPeriodStart: Date;
  readonly authorId: string;
  readonly stableId: string;
}

async function assertLatestOutcomeSourcePage(
  tx: Prisma.TransactionClient,
  input: LatestOutcomeSourceInput,
  cursor: ReportCoordinate | undefined,
): Promise<void> {
  const coordinates = await lockNextReportPage(
    tx,
    input.source,
    input.targetPeriodStart,
    cursor,
  );
  if (coordinates.length === 0) return;
  const reports = await readLockedReports(tx, coordinates, input.authorId);
  for (const report of reports) {
    const section = await resolveEligibleOutcomeSourceSection(
      tx,
      report,
      input.authorId,
    );
    if (section?.items.some((item) => item.stableId === input.stableId)) {
      throw new LeadFormConstraintError(
        "This plan has a newer historical occurrence. Reload the report.",
      );
    }
  }
  if (coordinates.length < REPORT_LOCK_PAGE_SIZE) return;
  return assertLatestOutcomeSourcePage(
    tx,
    input,
    coordinates[REPORT_LOCK_PAGE_SIZE - 1],
  );
}

/** Rejects a shadowed source after locking and validating every newer report. */
export function assertLatestOutcomeSource(
  tx: Prisma.TransactionClient,
  input: LatestOutcomeSourceInput,
): Promise<void> {
  return assertLatestOutcomeSourcePage(tx, input, undefined);
}

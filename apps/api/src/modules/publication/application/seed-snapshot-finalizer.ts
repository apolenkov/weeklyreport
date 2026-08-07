import type { AssembledReport } from "@customreport/shared";
import type { PrismaClient } from "@prisma/client";

import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../../published-report-snapshot.js";

export type SeedSnapshotDatabase = Pick<PrismaClient, "report">;

class SeedSnapshotFinalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedSnapshotFinalizationError";
  }
}

const sortIds = (ids: readonly string[]): readonly string[] =>
  [...ids].sort((left, right) => left.localeCompare(right));

const targetReport = async (
  database: SeedSnapshotDatabase,
  reportId: string,
) => {
  const report = await database.report.findUnique({
    where: { id: reportId },
    select: { id: true, periodStatus: true },
  });

  if (!report) {
    throw new SeedSnapshotFinalizationError(
      `Cannot finalize snapshot for unknown report ${reportId}.`,
    );
  }
  if (report.periodStatus !== "published") {
    throw new SeedSnapshotFinalizationError(
      `Cannot finalize snapshot for non-published report ${reportId}.`,
    );
  }

  return report;
};

const assembleSnapshot = (
  reportId: string,
  row: Parameters<typeof buildAssembledReportFromPrismaRow>[0],
): AssembledReport => {
  try {
    return buildAssembledReportFromPrismaRow(row);
  } catch {
    throw new SeedSnapshotFinalizationError(
      `Snapshot mapping failed for published report ${reportId}.`,
    );
  }
};

/**
 * Freeze one already-published report through the same representation used by
 * the publication write path. This deliberately has no side-effect port: the
 * only write is the immutable JSON column update.
 */
export async function finalizeSeededSnapshot(
  database: SeedSnapshotDatabase,
  reportId: string,
): Promise<AssembledReport> {
  await targetReport(database, reportId);
  const row = await database.report.findUnique({
    where: { id: reportId },
    include: reportFullIncludeForSnapshot,
  });

  if (!row) {
    throw new SeedSnapshotFinalizationError(
      `Published report ${reportId} disappeared during snapshot finalization.`,
    );
  }

  const snapshot = assembleSnapshot(reportId, row);
  try {
    await database.report.update({
      where: { id: reportId },
      data: { publishedSnapshot: toPublishedSnapshotJson(snapshot) },
    });
  } catch {
    throw new SeedSnapshotFinalizationError(
      `Snapshot persistence failed for published report ${reportId}.`,
    );
  }
  return snapshot;
}

export async function finalizeSeededSnapshots(
  database: SeedSnapshotDatabase,
  reportIds?: readonly string[],
): Promise<readonly AssembledReport[]> {
  const discoveredIds = reportIds
    ? sortIds([...new Set(reportIds)])
    : sortIds(
        (
          await database.report.findMany({
            where: { periodStatus: "published" },
            select: { id: true },
            orderBy: { id: "asc" },
          })
        ).map(({ id }) => id),
      );

  return Promise.all(
    discoveredIds.map((reportId) => finalizeSeededSnapshot(database, reportId)),
  );
}

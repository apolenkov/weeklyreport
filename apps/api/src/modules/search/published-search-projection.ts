import {
  type AssembledReport,
  buildPublishedProjections,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  requirePublishedSnapshot,
  toPublishedSnapshotJson,
} from "../report-sections/index.js";

interface ReplacePublishedProjectionInput {
  readonly reportId: string;
  readonly snapshot: unknown;
}

/** Atomically replaces both frozen projections for one report. */
export async function replacePublishedProjections(
  tx: Prisma.TransactionClient,
  input: ReplacePublishedProjectionInput,
): Promise<void> {
  const snapshot =
    input.snapshot === null
      ? null
      : requirePublishedSnapshot(input.snapshot, input.reportId);
  const projections =
    snapshot === null ? null : buildPublishedProjections(snapshot);

  await tx.publishedSearchDocument.deleteMany({
    where: { reportId: input.reportId },
  });
  await tx.publishedSectionScope.deleteMany({
    where: { reportId: input.reportId },
  });
  if (projections === null) return;
  if (projections.sectionScopes.length > 0) {
    await tx.publishedSectionScope.createMany({
      data: [...projections.sectionScopes],
    });
  }
  if (projections.searchDocuments.length > 0) {
    await tx.publishedSearchDocument.createMany({
      data: [...projections.searchDocuments],
    });
  }
}

/** Rebuilds exact frozen projections for every period in a recovery snapshot. */
export async function replaceRestoredPublishedProjections(
  tx: Prisma.TransactionClient,
  periods: readonly ReplacePublishedProjectionInput[],
): Promise<void> {
  for (const period of periods) {
    await replacePublishedProjections(tx, period);
  }
}

/**
 * Re-reads the report inside the caller's transaction, replaces its provisional
 * published snapshot with the full graph, and rebuilds both projections.
 */
export async function freezePublishedSnapshot(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<AssembledReport> {
  const row = await tx.report.findUniqueOrThrow({
    where: { id: reportId },
    include: reportFullIncludeForSnapshot,
  });
  const snapshot = buildAssembledReportFromPrismaRow(row);
  await tx.report.update({
    where: { id: reportId },
    data: { publishedSnapshot: toPublishedSnapshotJson(snapshot) },
  });
  await replacePublishedProjections(tx, { reportId, snapshot });
  return snapshot;
}

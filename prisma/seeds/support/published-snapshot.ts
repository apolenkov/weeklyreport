import {
  buildAssembledReportFromPrismaRow,
  parsePublishedSnapshot,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "@customreport/report-persistence";
import { buildPublishedProjections } from "@customreport/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

async function replaceSeedPublishedProjections(
  tx: Prisma.TransactionClient,
  reportId: string,
  snapshot: Prisma.JsonValue | Prisma.InputJsonValue,
): Promise<void> {
  const parsed = parsePublishedSnapshot(snapshot);
  const projections =
    parsed === null ? null : buildPublishedProjections(parsed);
  await tx.publishedSearchDocument.deleteMany({ where: { reportId } });
  await tx.publishedSectionScope.deleteMany({ where: { reportId } });
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

export function parseSeedPublishedSnapshot(value: Prisma.JsonValue | null) {
  return parsePublishedSnapshot(value);
}

export function provisionalPublishedSnapshot(input: {
  reportId: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  publishedAt: Date;
  publishedById: string;
  publishedByName: string;
}): Prisma.InputJsonValue {
  return toPublishedSnapshotJson({
    reportId: input.reportId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    deadline: input.deadline,
    status: "published",
    publishedAt: input.publishedAt,
    publishedById: input.publishedById,
    publishedByName: input.publishedByName,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [],
  });
}

export async function finalizePublishedSnapshots(
  prisma: PrismaClient,
): Promise<void> {
  const reportIds = await prisma.report.findMany({
    where: { status: "published" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  for (const { id } of reportIds) {
    await prisma.$transaction(async (tx) => {
      const report = await tx.report.findUniqueOrThrow({
        where: { id },
        include: reportFullIncludeForSnapshot,
      });
      const snapshot = buildAssembledReportFromPrismaRow(report);
      await tx.report.update({
        where: { id },
        data: { publishedSnapshot: toPublishedSnapshotJson(snapshot) },
      });
      await replaceSeedPublishedProjections(
        tx,
        id,
        toPublishedSnapshotJson(snapshot),
      );
    });
  }
}

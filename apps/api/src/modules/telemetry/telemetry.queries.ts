import type {
  PublishedReportSnapshot,
  UserSession,
} from "@customreport/shared";
import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  publishedReportScopeWhere,
  requirePublishedSnapshot,
  requireScopedPublishedSnapshot,
} from "../report-sections/index.js";

/** Selects immutable settled publications, including archived history. */
export function settledPublicationWhere(): PrismaTypes.ReportWhereInput {
  return {
    status: "published",
    periodStatus: "published",
    periodState: { in: ["published", "archived"] },
    publishedSnapshot: { not: Prisma.DbNull },
  };
}

/**
 * Returns newest settled publication snapshots. Scoped callers are filtered
 * from immutable frozen section ownership, never mutable User/Section rows.
 */
export async function querySettledPeriodSnapshots(
  prisma: PrismaService,
  take: number,
  session?: UserSession,
): Promise<PublishedReportSnapshot[]> {
  if (take <= 0) return [];

  const rows = await prisma.report.findMany({
    where: {
      ...settledPublicationWhere(),
      ...(session === undefined ? {} : publishedReportScopeWhere(session)),
    },
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    take,
    select: { id: true, publishedSnapshot: true },
  });

  return rows.flatMap((row) => {
    const snapshot = requirePublishedSnapshot(row.publishedSnapshot, row.id);
    const scoped = session
      ? requireScopedPublishedSnapshot(snapshot, session)
      : snapshot;
    return [scoped];
  });
}

// Shared by dashboard summary and Prometheus gauge so the two never drift.
export async function queryActiveLeadsLastPublishedPeriod(
  prisma: PrismaService,
  session?: UserSession,
): Promise<number> {
  const [snapshot] = await querySettledPeriodSnapshots(prisma, 1, session);
  if (!snapshot) return 0;
  return new Set(
    snapshot.sections
      .filter((section) => section.status === "submitted")
      .map((section) => section.authorId),
  ).size;
}

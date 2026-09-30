import type { PeriodStatus } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  publishedReportScopeWhere,
  requirePublishedSnapshot,
  requireScopedPublishedSnapshot,
} from "../report-sections/index.js";
import type { CompiledHistoryReportRow } from "./compiled-history.js";
import type { WeeklyReportScopeSession } from "./weekly-report.service.js";

// Cap history list size; archive count is separate so the UI can still offer expand.
const COMPILED_HISTORY_PAGE_SIZE = 100;

// Viewer-only: reopened periods (status published, periodStatus reopened)
// would appear as broken History links; head/lead must still see them.
function viewerPeriodWhere(
  session: WeeklyReportScopeSession,
): Prisma.ReportWhereInput {
  return session.role === "viewer"
    ? { periodStatus: "published" as const }
    : {};
}

function historyListWhere(
  session: WeeklyReportScopeSession,
  includeArchive: boolean,
): Prisma.ReportWhereInput {
  return {
    status: "published" as const,
    ...(includeArchive ? {} : { archived: false }),
    ...viewerPeriodWhere(session),
    ...publishedReportScopeWhere(session, "lead-own"),
  };
}

function historyArchiveCountWhere(
  session: WeeklyReportScopeSession,
): Prisma.ReportWhereInput {
  return {
    status: "published" as const,
    archived: true,
    ...viewerPeriodWhere(session),
    ...publishedReportScopeWhere(session, "lead-own"),
  };
}

function toScopedHistoryRow(
  report: {
    readonly id: string;
    readonly archived: boolean;
    readonly periodStatus: PeriodStatus;
    readonly publishedSnapshot: Prisma.JsonValue | null;
  },
  session: WeeklyReportScopeSession,
): CompiledHistoryReportRow {
  const snapshot = requirePublishedSnapshot(
    report.publishedSnapshot,
    report.id,
  );
  const scopedSnapshot = requireScopedPublishedSnapshot(
    snapshot,
    session,
    "lead-own",
  );
  return {
    archived: report.archived,
    reopened: report.periodStatus === "reopened",
    snapshot: scopedSnapshot,
  };
}

export async function queryCompiledHistory(
  prisma: PrismaService,
  session: WeeklyReportScopeSession,
  includeArchive: boolean,
): Promise<{
  reports: readonly CompiledHistoryReportRow[];
  archiveCount: number;
}> {
  const [reportCandidates, archiveCount] = await Promise.all([
    prisma.report.findMany({
      where: historyListWhere(session, includeArchive),
      orderBy: [
        { periodStart: "desc" },
        { publishedAt: "desc" },
        { id: "desc" },
      ],
      take: COMPILED_HISTORY_PAGE_SIZE,
      select: {
        id: true,
        archived: true,
        periodStatus: true,
        publishedSnapshot: true,
      },
    }),
    prisma.report.count({
      where: historyArchiveCountWhere(session),
    }),
  ]);

  const reports = reportCandidates.map((report) =>
    toScopedHistoryRow(report, session),
  );

  return { reports, archiveCount };
}

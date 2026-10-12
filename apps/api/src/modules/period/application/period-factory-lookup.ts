import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { currentPeriodLifecycleSchema } from "@weeklyreport/shared";

import type { EnsuredPeriod } from "./period-factory-types.js";

export const SELECT_PERIOD = {
  id: true,
  periodStart: true,
  periodEnd: true,
  deadline: true,
  status: true,
  periodState: true,
  periodStatus: true,
  archived: true,
  autoPublished: true,
  autoArchived: true,
  publishedAt: true,
  publishedById: true,
  reopenedAt: true,
} as const;

/** The only report rows that can occupy the scheduler's live future horizon. */
const LIVE_SCHEDULER_PERIOD_WHERE = {
  status: "draft",
  periodStatus: "open",
  periodState: { in: ["scheduled", "open"] },
  archived: false,
} satisfies Prisma.ReportWhereInput;

export class PeriodLifecycleIntegrityError extends Error {
  constructor() {
    super("Stored period lifecycle is inconsistent.");
    this.name = "PeriodLifecycleIntegrityError";
  }
}

interface DraftPeriodRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly deadline: Date | null;
  readonly status: unknown;
  readonly periodState: unknown;
  readonly periodStatus: unknown;
  readonly archived: unknown;
  readonly autoPublished: unknown;
  readonly autoArchived: unknown;
  readonly publishedAt: unknown;
  readonly publishedById: unknown;
  readonly reopenedAt: unknown;
}

type ReportLookupDelegate = Pick<PrismaClient["report"], "findMany">;

type LatestPeriodLookupDelegate = Pick<PrismaClient["report"], "findFirst">;

export interface MostRecentLivePeriod {
  readonly id: string;
  readonly periodEnd: Date;
}

function readLivePeriod(rows: readonly DraftPeriodRow[]): EnsuredPeriod | null {
  const liveRows = rows
    .map((row) => {
      const lifecycle = currentPeriodLifecycleSchema.safeParse(row);
      if (!lifecycle.success) throw new PeriodLifecycleIntegrityError();
      const { status, periodStatus, archived, periodState } = lifecycle.data;
      if (
        status !== "draft" ||
        periodStatus !== "open" ||
        archived ||
        (periodState !== "scheduled" && periodState !== "open")
      )
        return null;
      return {
        created: false as const,
        reportId: row.id,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        deadline: row.deadline,
        periodState,
      };
    })
    .filter((row) => row !== null);
  if (liveRows.length > 1) throw new PeriodLifecycleIntegrityError();
  return liveRows[0] ?? null;
}

export async function readBoundaryPeriod(
  report: ReportLookupDelegate,
  periodStart: Date,
  periodEnd: Date,
): Promise<EnsuredPeriod | null> {
  const rows = await report.findMany({
    where: { periodStart, periodEnd },
    select: SELECT_PERIOD,
  });
  return readLivePeriod(rows);
}

// Manual admin periods may use a non-Monday boundary. When no exact scheduler
// boundary exists, a single live range containing the anchor is the current
// period and must win over lazy canonical creation. Partial overlaps that do
// not contain the anchor remain conflicts at the database write boundary.
export async function readContainingPeriod(
  report: ReportLookupDelegate,
  anchorDate: Date,
): Promise<EnsuredPeriod | null> {
  const rows = await report.findMany({
    where: {
      periodStart: { lte: anchorDate },
      periodEnd: { gte: anchorDate },
    },
    select: SELECT_PERIOD,
  });
  return readLivePeriod(rows);
}

/** Reads the latest valid live scheduler period, ignoring archived and stale rows. */
export async function readMostRecentLivePeriod(
  report: LatestPeriodLookupDelegate,
): Promise<MostRecentLivePeriod | null> {
  const row = await report.findFirst({
    where: LIVE_SCHEDULER_PERIOD_WHERE,
    orderBy: { periodStart: "desc" },
    select: { id: true, periodEnd: true },
  });
  return row;
}

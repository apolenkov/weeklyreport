import type { PeriodState } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { lockAllReminderPolicies } from "../reminders/index.js";
import type { PeriodRowFromRepo } from "./admin-shared";
import { AdminAccessError, AdminPeriodNotFoundError } from "./admin-shared.js";

// Read side of the Admin Periods tab; lifecycle-transition writes
// (create/update/archive/unarchive) live in `admin-period-lifecycle.ts`.

type PeriodSelection = Omit<PeriodRowFromRepo, "submittedCount" | "totalCount">;

interface SectionProgress {
  readonly totalsById: ReadonlyMap<string, number>;
  readonly submittedById: ReadonlyMap<string, number>;
}

// Two grouped queries beat N per-period counts, and keeping totals separate
// from the submitted filter is what makes zero-total periods (created before
// section provisioning ran) visible instead of silently absent.
async function fetchSectionProgress(
  prisma: PrismaService,
  reportIds: string[],
): Promise<SectionProgress> {
  const [totalRows, submittedRows] = await Promise.all([
    prisma.reportSection.groupBy({
      by: ["reportId"],
      where: { reportId: { in: reportIds } },
      _count: { _all: true },
    }),
    prisma.reportSection.groupBy({
      by: ["reportId"],
      where: { reportId: { in: reportIds }, status: "submitted" },
      _count: { _all: true },
    }),
  ]);

  return {
    totalsById: new Map(
      totalRows.map((row) => [row.reportId, row._count._all]),
    ),
    submittedById: new Map(
      submittedRows.map((row) => [row.reportId, row._count._all]),
    ),
  };
}

function toPeriodRow(
  period: PeriodSelection,
  progress: SectionProgress,
): PeriodRowFromRepo {
  return {
    ...period,
    submittedCount: progress.submittedById.get(period.id) ?? 0,
    totalCount: progress.totalsById.get(period.id) ?? 0,
  };
}

// Rides the `(periodState, periodStart desc)` composite index so filtering and
// ordering stay on the same access path; progress stays at O(1) round-trips
// regardless of page size.
export async function listPeriodsByState(
  prisma: PrismaService,
  filter: {
    states: readonly PeriodState[];
    limit: number;
  },
): Promise<PeriodRowFromRepo[]> {
  const periods = await prisma.report.findMany({
    where: { periodState: { in: filter.states as PeriodState[] } },
    orderBy: { periodStart: "desc" },
    take: filter.limit,
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      deadline: true,
      publishedAt: true,
      periodState: true,
      periodStatus: true,
      archived: true,
      autoPublished: true,
      autoArchived: true,
      weekLabel: true,
    },
  });

  if (periods.length === 0) return [];

  const progress = await fetchSectionProgress(
    prisma,
    periods.map((period) => period.id),
  );

  return periods.map((period) => toPeriodRow(period, progress));
}

// Closed (inclusive) live-range intersect: a.start <= b.end AND a.end >=
// b.start. Historical published/archived rows are outside the database range
// constraint and must not make the friendly precheck stricter than the writer.
// Newest match wins so the gate can name the blocking row's date span.
export async function findOverlappingPeriod(
  prisma: PrismaService,
  input: {
    periodStart: Date;
    periodEnd: Date;
    // Lets the update path re-run the gate without self-conflicting against
    // the row being edited; omitted by create callers, who need no exclusion.
    excludeId?: string;
  },
): Promise<{ id: string; periodStart: Date; periodEnd: Date } | null> {
  const row = await prisma.report.findFirst({
    where: {
      periodState: { in: ["scheduled", "open"] },
      periodStart: { lte: input.periodEnd },
      periodEnd: { gte: input.periodStart },
      ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
    },
    orderBy: { periodStart: "desc" },
    select: { id: true, periodStart: true, periodEnd: true },
  });
  return row ?? null;
}

// Selection is the audit envelope's `from`-snapshot shape, not the full row.
export async function readPeriodById(
  prisma: PrismaService,
  periodId: string,
): Promise<{
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date | null;
  weekLabel: string | null;
  periodState: PeriodState;
} | null> {
  return prisma.report.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      deadline: true,
      weekLabel: true,
      periodState: true,
    },
  });
}

// Delete only while the same database operation proves that the report is a
// draft, open, and non-archived. The follow-up read is classification only;
// it never authorizes a delete and therefore cannot reopen the TOCTOU window.
export async function deleteReport(
  prisma: PrismaService,
  reportId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Report deletion cascades ReminderRule rows. Match restore and every
    // reminder writer by taking the policy locks first, so the FK cascade
    // cannot invert the policy -> report -> rule lock order.
    await lockAllReminderPolicies(tx);

    // Lock the lifecycle row before inspecting lineage. CarryOverExecution
    // intentionally uses RESTRICT report FKs, and a concurrent carry-over may
    // reference this report as either source or target. The row lock makes
    // cleanup and the lifecycle compare-and-delete one atomic ownership point.
    const locked = await tx.$queryRaw<
      { id: string; status: string; periodStatus: string; archived: boolean }[]
    >`
      SELECT "id", "status", "periodStatus", "archived"
      FROM "Report"
      WHERE "id" = ${reportId}
      FOR UPDATE
    `;
    const current = locked.at(0);
    if (!current) {
      throw new AdminPeriodNotFoundError(`Report ${reportId} not found.`);
    }
    if (
      current.status !== "draft" ||
      current.periodStatus !== "open" ||
      current.archived
    ) {
      throw new AdminAccessError(
        "Only an open, unarchived draft period can be deleted.",
      );
    }

    // Remove the children inside this same transaction before deleting the
    // execution rows and the report. This is explicit ownership rather than a
    // schema-level cascade, preserving RESTRICT for all other delete paths.
    const executions = await tx.carryOverExecution.findMany({
      where: {
        OR: [{ sourceReportId: reportId }, { targetReportId: reportId }],
      },
      select: { id: true },
    });
    if (executions.length > 0) {
      const executionIds = executions.map(({ id }) => id);
      await tx.carryOverRecord.deleteMany({
        where: { executionId: { in: executionIds } },
      });
      await tx.carryOverExecution.deleteMany({
        where: { id: { in: executionIds } },
      });
    }

    const deleted = await tx.report.deleteMany({
      where: {
        id: reportId,
        status: "draft",
        periodStatus: "open",
        archived: false,
      },
    });
    if (deleted.count > 0) return;

    // The row was locked and classified above. A zero-row result here means a
    // lifecycle writer violated the guarded contract; fail closed.
    throw new AdminAccessError(
      "Only an open, unarchived draft period can be deleted.",
    );
  });
}

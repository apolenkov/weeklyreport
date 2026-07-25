import type {
  PeriodState,
  PeriodStatus,
  ReportStatus,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PeriodRowFromRepo } from "./admin-shared";

/**
 * Period (Report) read queries for the Admin Periods tab: list/overlap/read/
 * delete-guard read/delete. Lifecycle-transition writes (create/update/
 * archive/unarchive) live in `admin-period-lifecycle.ts`.
 */

/**
 * Fetch periods matching the supplied state set, sorted newest-first
 * by `periodStart`. Submission progress (submitted vs total section
 * count) is fetched in a single grouped query so the list endpoint
 * stays at O(1) round-trips regardless of page size.
 *
 * Uses the `(periodState, periodStart desc)` composite index so filtering and
 * ordering stay on the same access path.
  * @param prisma - The prisma argument.
 * @param filter - The filter argument.
 */
export async function listPeriodsByState(
  prisma: PrismaService,
  filter: {
    states: readonly PeriodState[];
    limit: number;
  },
): Promise<PeriodRowFromRepo[]> {
  const reports = await prisma.report.findMany({
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

  if (reports.length === 0) return [];

  const reportIds = reports.map((r) => r.id);

  // Section progress in two grouped queries (one for totals, one for
  // submitted). Cheaper than N per-period counts and cheaper than a
  // single `groupBy` with a `where: status: submitted` because the
  // totals query also reveals zero-total periods (newly created with
  // no sections yet — the auto-creator may not have run section
  // provisioning yet).
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

  const totalsById = new Map(
    totalRows.map((row) => [row.reportId, row._count._all]),
  );
  const submittedById = new Map(
    submittedRows.map((row) => [row.reportId, row._count._all]),
  );

  return reports.map((r) => ({
    id: r.id,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    deadline: r.deadline,
    publishedAt: r.publishedAt,
    periodState: r.periodState,
    periodStatus: r.periodStatus,
    archived: r.archived,
    autoPublished: r.autoPublished,
    autoArchived: r.autoArchived,
    submittedCount: submittedById.get(r.id) ?? 0,
    totalCount: totalsById.get(r.id) ?? 0,
    weekLabel: r.weekLabel,
  }));
}

/**
 * Find the most recent Report whose [periodStart, periodEnd]
 * range overlaps the supplied closed (inclusive) range. Used by the service's
 * pre-create overlap gate to surface the blocking row's date span.
 * Returns null when the range is free.
 *
 * Closed (inclusive) intersect: a.start <= b.end AND a.end >= b.start.
  * @param prisma - The prisma argument.
 * @param input - The input argument.
 */
export async function findOverlappingPeriod(
  prisma: PrismaService,
  input: {
    periodStart: Date;
    periodEnd: Date;
    /**
     * Excluded id so the update path can re-run the overlap
     * gate without self-conflicting against the row being edited. The
     * Prisma `NOT: { id }` clause stays out of the WHERE when the
     * caller omits the field — pure additive change for create callers.
     */
    excludeId?: string;
  },
): Promise<{ id: string; periodStart: Date; periodEnd: Date } | null> {
  const row = await prisma.report.findFirst({
    where: {
      periodStart: { lte: input.periodEnd },
      periodEnd: { gte: input.periodStart },
      ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
    },
    orderBy: { periodStart: "desc" },
    select: { id: true, periodStart: true, periodEnd: true },
  });
  return row ?? null;
}

/**
 * Read a single Report's edit envelope. Used by the service's
 * updatePeriodManual to surface a `NOT_FOUND` error early and to grab
 * the `from`-snapshot for the audit envelope.
  * @param prisma - The prisma argument.
 * @param periodId - The periodId argument.
 */
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
  const row = await prisma.report.findUnique({
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
  if (!row) return null;
  return {
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    deadline: row.deadline,
    weekLabel: row.weekLabel,
    periodState: row.periodState,
  };
}

/**
 * Read a Report's status fields for delete-guard checks.
 * Returns null if not found.
  * @param prisma - The prisma argument.
 * @param reportId - The reportId argument.
 */
export async function readReportForDelete(
  prisma: PrismaService,
  reportId: string,
): Promise<{ status: ReportStatus; periodStatus: PeriodStatus } | null> {
  const row = await prisma.report.findUnique({
    where: { id: reportId },
    select: { status: true, periodStatus: true },
  });
  if (!row) return null;
  return {
    status: row.status,
    periodStatus: row.periodStatus,
  };
}

/**
 * Delete a Report and cascade-delete all child rows via Prisma relations
 * (onDelete: Cascade on ReportSection, Item, Risk, Decision, Priority, etc.).
  * @param prisma - The prisma argument.
 * @param reportId - The reportId argument.
 */
export async function deleteReport(
  prisma: PrismaService,
  reportId: string,
): Promise<void> {
  await prisma.report.delete({ where: { id: reportId } });
}

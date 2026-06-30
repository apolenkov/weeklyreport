import type { PeriodState, PeriodStatus } from "@customreport/shared";
import type { ReportStatus } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { isOpenBoundaryConflict } from "../period/period-factory.js";
import { buildTransition } from "../period/period-transition.js";
import type { PeriodRowFromRepo } from "./admin.service";
import {
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
} from "./admin-shared.js";

/**
 * Period (Report) lifecycle queries for the Admin Periods tab, extracted from
 * `admin.prisma-repository.ts` (R3a-4 max-lines split): list/overlap/create/
 * read/update/archive/unarchive/delete.
 */

/**
 * Run a period write that moves/keeps a row at `periodState = 'open'`,
 * translating the `Report_one_open_per_boundary` P2002 into the same friendly
 * overlap error the `findOverlappingPeriod` pre-check raises (→ BAD_REQUEST),
 * instead of a raw 500. A race that defeats the pre-check on create, a date
 * edit onto a contested boundary, or an unarchive into one all land here. Any
 * other error (including an unrelated unique violation) re-throws unchanged.
 */
async function openBoundaryGuarded<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isOpenBoundaryConflict(error)) {
      throw new AdminPeriodOverlapError(
        "A period already exists for these dates.",
      );
    }
    throw error;
  }
}

/**
 * Fetch periods matching the supplied state set, sorted newest-first
 * by `periodStart`. Submission progress (submitted vs total section
 * count) is fetched in a single grouped query so the list endpoint
 * stays at O(1) round-trips regardless of page size.
 *
 * Uses the `(periodState, periodStart desc)` composite index from
 * 51-C — no plan-time index gap.
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
 * UFB-063: find the most recent Report whose [periodStart, periodEnd]
 * range overlaps the supplied half-open range. Used by the service's
 * pre-create overlap gate to surface the blocking row's date span.
 * Returns null when the range is free.
 *
 * Half-open intersect: a.start <= b.end AND a.end >= b.start.
 */
export async function findOverlappingPeriod(
  prisma: PrismaService,
  input: {
    periodStart: Date;
    periodEnd: Date;
    /**
     * UFB-067: excluded id so the update path can re-run the overlap
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
 * UFB-063: mint a Report row with the supplied dates + initial state.
 * Mirrors `PeriodCreatorScheduler.runOnce`'s bare `report.create` —
 * `status` defaults to 'draft' and `periodStatus` defaults to 'open'
 * at the DB layer (see schema.prisma defaults). No PolicyApplicator
 * call here — the scheduler also skips it (pre-existing gap,
 * documented in the 063 SUMMARY); fixing both paths is deferred to
 * keep this plan additive.
 */
export async function createPeriodManual(
  prisma: PrismaService,
  input: {
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    weekLabel: string | null;
    periodState: PeriodState;
  },
): Promise<{
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  periodState: PeriodState;
}> {
  const created = await openBoundaryGuarded(() =>
    prisma.report.create({
      data: {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: input.deadline,
        weekLabel: input.weekLabel,
        // refactor-period-transition-writer: lifecycle fields (periodState +
        // legacy status/archived tuple) come from the transition builder, not
        // hand-assembled. The service resolves the initial state to
        // 'scheduled' | 'open'; both map to a draft/false legacy tuple, which
        // the schedule/open transitions produce.
        ...buildTransition(
          input.periodState === "scheduled" ? "schedule" : "open",
          {},
        ),
      },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        deadline: true,
        periodState: true,
      },
    }),
  );
  return {
    id: created.id,
    periodStart: created.periodStart,
    periodEnd: created.periodEnd,
    deadline: created.deadline,
    periodState: created.periodState,
  };
}

/**
 * UFB-067: read a single Report's edit envelope. Used by the service's
 * updatePeriodManual to surface a `NOT_FOUND` error early and to grab
 * the `from`-snapshot for the audit envelope.
 */
export async function readPeriodById(
  prisma: PrismaService,
  periodId: string,
): Promise<{
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
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
 * UFB-067: patch an existing Report's date envelope + weekLabel. The
 * service has already filtered `data` down to actually-changed fields,
 * so Prisma's partial-update semantics are exactly what we want — only
 * supplied keys are written, the rest of the row stays untouched.
 *
 * `periodState` is NOT touched here. State transitions belong to the
 * lifecycle actions (`publish`, `reopen`, `archive`, scheduler). The
 * Edit dialog only moves dates / label; if a date shift implies a
 * state transition, that's a follow-up plan.
 */
export async function updatePeriodManual(
  prisma: PrismaService,
  input: {
    reportId: string;
    data: {
      periodStart?: Date;
      periodEnd?: Date;
      deadline?: Date;
      weekLabel?: string | null;
    };
  },
): Promise<{
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  weekLabel: string | null;
  periodState: PeriodState;
}> {
  const updated = await openBoundaryGuarded(() =>
    prisma.report.update({
      where: { id: input.reportId },
      data: input.data,
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        deadline: true,
        weekLabel: true,
        periodState: true,
      },
    }),
  );
  return {
    id: updated.id,
    periodStart: updated.periodStart,
    periodEnd: updated.periodEnd,
    deadline: updated.deadline,
    weekLabel: updated.weekLabel,
    periodState: updated.periodState,
  };
}

/**
 * UFB-052 (Phase 51-B): manual archive. Writes both the legacy
 * `archived` boolean and the new `periodState='archived'` atomically
 * so the two-state-machine invariant from 51-C (Open Question 1)
 * holds even when the auto-archiver scheduler hasn't run yet.
 */
export async function archivePeriod(
  prisma: PrismaService,
  periodId: string,
): Promise<void> {
  await prisma.report.update({
    where: { id: periodId },
    // refactor-period-transition-writer: archive field set from the builder.
    data: buildTransition("archive", {}),
  });
}

/**
 * UFB-052 (Phase 51-B): un-archive — flips `archived=false` and
 * derives the next `periodState` from the legacy tuple. The legacy
 * `(status, periodStatus)` pair is the only ground truth left after
 * a row was set to `'archived'`, so we read it on the same row and
 * project back:
 *
 *   status='published' OR periodStatus IN ('published','reopened')
 *     → periodState='published'
 *   else
 *     → periodState='open'
 *
 * The scheduled→open distinction is lost across an archive round-trip;
 * that is acceptable because admin archive of a SCHEDULED period is
 * a tiny edge case (the PeriodCreator scheduler would just re-mint
 * the row anyway). Documented in the 51-B SUMMARY.
 */
export async function unarchivePeriod(
  prisma: PrismaService,
  periodId: string,
): Promise<{ nextPeriodState: PeriodState; nextPeriodStatus: PeriodStatus }> {
  const row = await prisma.report.findUnique({
    where: { id: periodId },
    select: { status: true, periodStatus: true },
  });
  if (!row) {
    throw new AdminPeriodNotFoundError(`Report ${periodId} not found.`);
  }
  const nextPeriodState: PeriodState =
    row.status === "published" || row.periodStatus !== "open"
      ? "published"
      : "open";
  const nextPeriodStatus = row.periodStatus;
  // Unarchiving back to 'open' can collide with an open period that took the
  // boundary while this one was archived; that update hits the partial index.
  await openBoundaryGuarded(() =>
    prisma.report.update({
      where: { id: periodId },
      // refactor-period-transition-writer: the caller-derived next state (read
      // from the surviving legacy tuple above) flows into the unarchive
      // transition, which clears `archived` and sets `periodState`.
      data: buildTransition("unarchive", { nextPeriodState }),
    }),
  );
  return { nextPeriodState, nextPeriodStatus };
}

/**
 * A27: read a Report's status fields for delete-guard checks.
 * Returns null if not found.
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
 * A27: delete a Report and cascade-delete all child rows via Prisma relations
 * (onDelete: Cascade on ReportSection, Item, Risk, Decision, Priority, etc.).
 */
export async function deleteReport(
  prisma: PrismaService,
  reportId: string,
): Promise<void> {
  await prisma.report.delete({ where: { id: reportId } });
}

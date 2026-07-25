import type { PeriodState, PeriodStatus } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { buildTransition, isOpenBoundaryConflict } from "../period/index.js";
import {
  AdminPeriodAlreadyArchivedError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
} from "./admin-shared.js";

/**
 * Period (Report) lifecycle-transition writes for the Admin Periods tab:
 * create, update, archive, unarchive — every mutation that runs through
 * `buildTransition` and can race the `Report_one_open_per_boundary`
 * partial-unique index.
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
 * Mint a Report row with the supplied dates + initial state.
 * Mirrors `PeriodCreatorScheduler.runOnce`'s bare `report.create` —
 * `status` defaults to 'draft' and `periodStatus` defaults to 'open'
 * at the DB layer (see schema.prisma defaults). This function only
 * writes the row; the reminder rules are materialized by the caller —
 * `AdminPrismaRepository.createPeriodManual` invokes `applyToPeriod`
 * after this create commits.
 * @param prisma - The prisma argument.
 * @param input - The input argument.
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
        // Lifecycle fields (periodState +
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
  // The insert above always writes a deadline (creation is never
  // deadline-less); a null read-back would mean schema drift — fail loud
  // rather than widen the create contract.
  if (created.deadline === null) {
    throw new Error("Created period unexpectedly has no deadline.");
  }
  return {
    id: created.id,
    periodStart: created.periodStart,
    periodEnd: created.periodEnd,
    deadline: created.deadline,
    periodState: created.periodState,
  };
}

/**
 * Patch an existing Report's date envelope + weekLabel. The
 * service has already filtered `data` down to actually-changed fields,
 * so Prisma's partial-update semantics are exactly what we want — only
 * supplied keys are written, the rest of the row stays untouched.
 *
 * `periodState` is NOT touched here. State transitions belong to the
 * lifecycle actions (`publish`, `reopen`, `archive`, scheduler). The
 * Edit dialog only moves dates / label; if a date shift implies a
 * state transition, that's a follow-up plan.
 * @param prisma - The prisma argument.
 * @param input - The input argument.
 */
export async function updatePeriodManual(
  prisma: PrismaService,
  input: {
    reportId: string;
    data: {
      periodStart?: Date;
      periodEnd?: Date;
      deadline?: Date | null;
      weekLabel?: string | null;
    };
  },
): Promise<{
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date | null;
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
 * Manual archive. A guarded `updateMany` makes the write mutually exclusive
 * with a concurrent head reopen from the archive side of the race: only a
 * still-published, not-yet-archived row transitions, and a zero-row match fails
 * closed rather than re-writing the row unconditionally. Writes both the legacy
 * `archived` boolean and the new `periodState='archived'` from the transition
 * builder in that single statement, so the two-state-machine invariant holds
 * even when the auto-archiver scheduler hasn't run yet.
 *
 * The predicate excludes `periodStatus: "reopened"` alongside `archived: false`
 * so it shares the reopen compare-and-set's discriminator column: a reopen that
 * wins the row first flips `periodStatus` to `reopened`, which drops this
 * archive to zero rows — without it, a reopen-then-archive interleaving would
 * leave an archived period whose sections the reopen had already reset to draft.
 * It deliberately does NOT require `periodStatus: "published"`: head/admin
 * archive is unbounded by period status (product decision — the head is
 * trusted), so scheduled/open periods stay archivable; only the reopened state
 * — whose archive would freeze just-reset draft sections either way — is
 * refused.
 * @param prisma - The prisma argument.
 * @param periodId - The periodId argument.
 */
export async function archivePeriod(
  prisma: PrismaService,
  periodId: string,
): Promise<void> {
  const { count } = await prisma.report.updateMany({
    where: {
      id: periodId,
      archived: false,
      periodStatus: { not: "reopened" },
    },
    data: buildTransition("archive", {}),
  });
  if (count === 0) {
    throw new AdminPeriodAlreadyArchivedError(
      `Period ${periodId} can no longer be archived — it was already archived or reopened by a concurrent action.`,
    );
  }
}

/**
 * Un-archive — flips `archived=false` and
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
 * the row anyway).
 * @param prisma - The prisma argument.
 * @param periodId - The periodId argument.
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
      // The caller-derived next state (read
      // from the surviving legacy tuple above) flows into the unarchive
      // transition, which clears `archived` and sets `periodState`.
      data: buildTransition("unarchive", { nextPeriodState }),
    }),
  );
  return { nextPeriodState, nextPeriodStatus };
}

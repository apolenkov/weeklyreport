import type { AppSettings, PeriodState } from "@customreport/shared";
import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";

import {
  computeDeadline,
  getCurrentWeekBounds,
} from "../../../lib/business-date.js";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import type { PolicyApplicatorService } from "../../reminders/index.js";
import {
  buildTransition,
  initialPeriodState,
} from "../domain/period-transition.js";

// The single sanctioned period-creation writer: both the period-creator cron
// scheduler and the lazy login-create path route through here, so the deadline
// formula and the coupled lifecycle write exist once. See
// `openspec/specs/period-dual-state/spec.md` for why the write must stay a
// `...buildTransition("create", ...)` spread.

// Wall-clock hour (in the configured timezone) the deadline lands on; mirrors
// the period-creator scheduler's constant. Intentionally not a setting.
const DEADLINE_HOUR = 18;

// Partial unique index (raw SQL in the init migration) constraining
// `(periodStart, periodEnd)` across both `scheduled` and `open` rows, so racing
// creators cannot persist two live pre-published rows.
const OPEN_BOUNDARY_INDEX = "Report_one_open_per_boundary";

/** Settings the factory reads; a structural subset of {@link AppSettings}. */
export type PeriodFactorySettings = Pick<
  AppSettings,
  "periodLengthDays" | "defaultDeadlineDays" | "workingDays" | "defaultTimezone"
>;

export interface EnsuredPeriod {
  /** True when this call minted the row; false when it found an existing one. */
  created: boolean;
  reportId: string;
  periodStart: Date;
  periodEnd: Date;
  // Null only on a found (not minted) row whose deadline an admin explicitly
  // cleared; a freshly minted period always carries one.
  deadline: Date | null;
  // A draft period can only be `scheduled` or `open` (the legacy `status:"draft"`
  // tuple maps to exactly those two states), so the public shape stays narrow.
  periodState: Extract<PeriodState, "scheduled" | "open">;
}

/** The Prisma `report` delegate surface the factory needs. */
type ReportDelegate = Pick<PrismaClient["report"], "findFirst" | "create">;

/** Minimal applicator seam — injected so reminder-free tests need no mock. */
type ReminderApplicator = Pick<PolicyApplicatorService, "applyToPeriod">;

const SELECT_PERIOD = {
  id: true,
  periodStart: true,
  periodEnd: true,
  deadline: true,
  periodState: true,
} as const;

// A `status:"draft"` row is `scheduled` or `open` by the period-dual-state
// invariant (a reopened period carries `status:"published"`). The DB column is
// typed as the wider union, so narrow it where the invariant holds.
function narrowDraftState(
  state: PeriodState,
): Extract<PeriodState, "scheduled" | "open"> {
  return state === "scheduled" ? "scheduled" : "open";
}

// Exported so every open-boundary writer — admin create/update, reopen,
// unarchive, the scheduler flip and this factory — translates the SAME P2002
// identically; the engine-dependent error shapes live in `isUniqueViolation`.
export function isOpenBoundaryConflict(error: unknown): boolean {
  return isUniqueViolation(error, {
    index: OPEN_BOUNDARY_INDEX,
    columns: ["periodStart", "periodEnd"],
  });
}

interface DraftPeriodRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly deadline: Date | null;
  readonly periodState: PeriodState;
}

function toFoundPeriod(row: DraftPeriodRow): EnsuredPeriod {
  return {
    created: false,
    reportId: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    deadline: row.deadline,
    periodState: narrowDraftState(row.periodState),
  };
}

// Best-effort: the period is the durable artifact, so failing to materialise the
// secondary reminder rules must NOT fail the caller (a login must not 500 over
// reminders). The rows are recoverable via `pnpm db:backfill:reminder-policies`.
async function materialiseReminders(
  applicator: ReminderApplicator,
  period: { readonly id: string; readonly deadline: Date },
  now: Date,
): Promise<void> {
  try {
    await applicator.applyToPeriod(period, now);
  } catch (error) {
    // Constructed here, not at module load: importing this file through the
    // period barrel must stay side-effect-free (a top-level `new Logger()`
    // couples every barrel consumer to Nest logging and breaks mocked tests).
    new Logger("PeriodFactory").warn(
      `applyToPeriod failed for period=${period.id}; reminder rules deferred to backfill: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

async function createPeriod(args: {
  readonly report: ReportDelegate;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly deadline: Date;
  readonly now: Date;
  readonly policyApplicator?: ReminderApplicator;
}): Promise<EnsuredPeriod> {
  const created = await args.report.create({
    data: {
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      deadline: args.deadline,
      ...buildTransition("create", {
        periodStart: args.periodStart,
        now: args.now,
      }),
    },
    select: SELECT_PERIOD,
  });

  if (args.policyApplicator && created.deadline !== null) {
    await materialiseReminders(
      args.policyApplicator,
      { id: created.id, deadline: created.deadline },
      args.now,
    );
  }

  return {
    created: true,
    reportId: created.id,
    periodStart: created.periodStart,
    periodEnd: created.periodEnd,
    deadline: created.deadline,
    periodState: initialPeriodState(args.periodStart, args.now),
  };
}

// The race loser re-reads the winner's row, which may already have flipped from
// `scheduled` to `open`; the winner runs its own reminder materialisation.
async function readRaceWinner(
  report: ReportDelegate,
  periodStart: Date,
  periodEnd: Date,
): Promise<EnsuredPeriod | null> {
  const won = await report.findFirst({
    where: {
      periodStart,
      periodEnd,
      periodState: { in: ["scheduled", "open"] },
    },
    select: SELECT_PERIOD,
  });
  return won ? toFoundPeriod(won) : null;
}

// Find-or-create the draft reporting period for the week of `anchorDate` (the
// login path passes `now`; the scheduler passes the day after the last period's
// end, so it mints the *next* cycle). `now` resolves the initial lifecycle state
// and bounds reminder materialisation to still-future instants — the reminders
// scheduler has no elapsed-`fireAt` guard, so a stale rule would blast at once.
export async function ensureCurrentPeriod(
  prisma: { report: ReportDelegate },
  anchorDate: Date,
  now: Date,
  settings: PeriodFactorySettings,
  policyApplicator?: ReminderApplicator,
): Promise<EnsuredPeriod> {
  const { periodStart, periodEnd } = getCurrentWeekBounds(
    anchorDate,
    settings.periodLengthDays,
  );

  const existing = await prisma.report.findFirst({
    where: {
      status: "draft",
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
    select: SELECT_PERIOD,
  });
  if (existing) return toFoundPeriod(existing);

  const deadline = computeDeadline(
    periodStart,
    settings.defaultDeadlineDays,
    settings.workingDays,
    settings.defaultTimezone,
    DEADLINE_HOUR,
  );

  try {
    return await createPeriod({
      report: prisma.report,
      periodStart,
      periodEnd,
      deadline,
      now,
      policyApplicator,
    });
  } catch (error) {
    // Concurrent creators collide on the partial unique index; the loser returns
    // the winner's row. Any other error re-throws.
    if (!isOpenBoundaryConflict(error)) throw error;
    const won = await readRaceWinner(prisma.report, periodStart, periodEnd);
    if (!won) throw error;
    return won;
  }
}

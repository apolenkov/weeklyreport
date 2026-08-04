import {
  type AppSettings,
  currentPeriodLifecycleSchema,
  type PeriodState,
} from "@customreport/shared";
import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";

import {
  computeDeadline,
  getCurrentWeekBounds,
  parseDeadlineTime,
} from "../../../lib/business-date.js";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import type { PolicyApplicatorService } from "../../reminders/index.js";
import {
  buildTransition,
  initialPeriodState,
} from "../domain/period-transition.js";

// The single sanctioned period-creation writer: the period-creator cron and the
// lazy login-create path both route through here, so the deadline formula and
// the coupled lifecycle write exist once (see period-dual-state spec).

// Partial unique index (raw SQL in the init migration) constraining
// `(periodStart, periodEnd)` across both `scheduled` and `open` rows, so racing
// creators cannot persist two live pre-published rows.
const OPEN_BOUNDARY_INDEX = "Report_one_open_per_boundary";

// Settings the factory reads; a structural subset of AppSettings.
export type PeriodFactorySettings = Pick<
  AppSettings,
  | "periodLengthDays"
  | "defaultDeadlineDays"
  | "workingDays"
  | "defaultTimezone"
  | "deadlineTime"
>;

export interface EnsuredPeriod {
  // True when this call minted the row; false when it found an existing one.
  readonly created: boolean;
  readonly reportId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  // Null only on a found (not minted) row whose deadline an admin explicitly
  // cleared; a freshly minted period always carries one.
  readonly deadline: Date | null;
  // A draft period can only be `scheduled` or `open` (the legacy `status:"draft"`
  // tuple maps to exactly those two states), so the public shape stays narrow.
  readonly periodState: Extract<PeriodState, "scheduled" | "open">;
}

// The Prisma `report` delegate surface the factory needs.
type ReportDelegate = Pick<PrismaClient["report"], "findMany" | "create">;

// Minimal applicator seam — injected so reminder-free tests need no mock.
type ReminderApplicator = Pick<PolicyApplicatorService, "applyToPeriod">;

const SELECT_PERIOD = {
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

export class PeriodLifecycleIntegrityError extends Error {
  constructor() {
    super("Stored period lifecycle is inconsistent.");
    this.name = "PeriodLifecycleIntegrityError";
  }
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

function toFoundPeriod(row: DraftPeriodRow): EnsuredPeriod {
  const lifecycle = currentPeriodLifecycleSchema.safeParse(row);
  if (
    !lifecycle.success ||
    (lifecycle.data.periodState !== "scheduled" &&
      lifecycle.data.periodState !== "open")
  ) {
    throw new PeriodLifecycleIntegrityError();
  }
  return {
    created: false,
    reportId: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    deadline: row.deadline,
    periodState: lifecycle.data.periodState,
  };
}

async function readBoundaryPeriod(
  report: ReportDelegate,
  periodStart: Date,
  periodEnd: Date,
): Promise<EnsuredPeriod | null> {
  const rows = await report.findMany({
    where: { periodStart, periodEnd },
    select: SELECT_PERIOD,
  });
  const liveRows = rows
    .map((row) => {
      const lifecycle = currentPeriodLifecycleSchema.safeParse(row);
      if (!lifecycle.success) throw new PeriodLifecycleIntegrityError();
      return lifecycle.data.periodState === "scheduled" ||
        lifecycle.data.periodState === "open"
        ? row
        : null;
    })
    .filter((row): row is (typeof rows)[number] => row !== null);
  if (liveRows.length > 1) throw new PeriodLifecycleIntegrityError();
  return liveRows[0] ? toFoundPeriod(liveRows[0]) : null;
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

// Find-or-create the draft reporting period for the week of `anchorDate` (login
// passes `now`; the scheduler passes the day after the last period's end). `now`
// bounds reminder materialisation to still-future instants.
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

  const existing = await readBoundaryPeriod(
    prisma.report,
    periodStart,
    periodEnd,
  );
  if (existing) return existing;

  const deadline = computeDeadline(
    periodStart,
    settings.defaultDeadlineDays,
    settings.workingDays,
    settings.defaultTimezone,
    parseDeadlineTime(settings.deadlineTime),
  );

  try {
    return await createPeriod({
      report: prisma.report,
      periodStart,
      periodEnd,
      deadline,
      now,
      ...(policyApplicator === undefined ? {} : { policyApplicator }),
    });
  } catch (error) {
    // Concurrent creators collide on the partial unique index; the loser returns
    // the winner's row. Any other error re-throws.
    if (!isOpenBoundaryConflict(error)) throw error;
    // The race loser re-reads the winner, which may already have flipped from
    // scheduled to open; the winner owns reminder materialisation.
    const won = await readBoundaryPeriod(prisma.report, periodStart, periodEnd);
    if (!won) throw error;
    return won;
  }
}

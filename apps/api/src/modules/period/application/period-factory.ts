import { type AppSettings } from "@customreport/shared";
import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";

import {
  computeDeadline,
  getCurrentWeekBounds,
  parseDeadlineTime,
} from "../../../lib/business-date.js";
import { isPrismaConstraintViolation } from "../../../lib/prisma/constraint-violation.js";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import type { PolicyApplicatorService } from "../../reminders/index.js";
import {
  buildTransition,
  initialPeriodState,
} from "../domain/period-transition.js";
import {
  readBoundaryPeriod,
  readContainingPeriod,
  SELECT_PERIOD,
} from "./period-factory-lookup.js";
import type { EnsuredPeriod } from "./period-factory-types.js";

// The single sanctioned period-creation writer: the period-creator cron and the
// lazy login-create path both route through here, so the deadline formula and
// the coupled lifecycle write exist once (see period-dual-state spec).

const LEGACY_OPEN_BOUNDARY_INDEX = "Report_one_open_per_boundary";
const PERIOD_OVERLAP_CONSTRAINT = "Report_no_live_period_overlap";
const PRISMA_DATABASE_CONSTRAINT_ERROR_CODES = ["P2004", "P2039"] as const;

// Settings the factory reads; a structural subset of AppSettings.
export type PeriodFactorySettings = Pick<
  AppSettings,
  | "periodLengthDays"
  | "defaultDeadlineDays"
  | "workingDays"
  | "defaultTimezone"
  | "deadlineTime"
>;

export type { EnsuredPeriod } from "./period-factory-types.js";

// The Prisma `report` delegate surface the factory needs.
type ReportDelegate = Pick<PrismaClient["report"], "findMany" | "create">;

// Minimal applicator seam — injected so reminder-free tests need no mock.
type ReminderApplicator = Pick<PolicyApplicatorService, "applyToPeriod">;

export { PeriodLifecycleIntegrityError } from "./period-factory-lookup.js";

export class PeriodOverlapError extends Error {
  constructor() {
    super("A reporting period overlaps an existing period.");
    this.name = "PeriodOverlapError";
  }
}

// During rolling migration, writers can see the legacy exact-boundary P2002.
// The range exclusion is P2004 through Prisma's engine path and P2039 through
// adapter-pg. Scope every path by constraint identity so unrelated database
// failures still propagate unchanged.
export function isPeriodOverlapConflict(error: unknown): boolean {
  return (
    isUniqueViolation(error, {
      index: LEGACY_OPEN_BOUNDARY_INDEX,
      columns: ["periodStart", "periodEnd"],
    }) ||
    PRISMA_DATABASE_CONSTRAINT_ERROR_CODES.some((code) =>
      isPrismaConstraintViolation(error, code, {
        index: PERIOD_OVERLAP_CONSTRAINT,
      }),
    )
  );
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

  const containing = await readContainingPeriod(prisma.report, anchorDate);
  if (containing) return containing;

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
    if (!isPeriodOverlapConflict(error)) throw error;
    // Exact-boundary creators converge on their winner. A different overlapping
    // range has no valid current-period result, so surface a typed domain error.
    const won = await readBoundaryPeriod(prisma.report, periodStart, periodEnd);
    if (!won) throw new PeriodOverlapError();
    return won;
  }
}

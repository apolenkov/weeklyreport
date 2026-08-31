import { type AppSettings } from "@customreport/shared";
import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";

import {
  computeDeadline,
  getCurrentWeekBounds,
  parseDeadlineTime,
} from "../../../lib/business-date.js";
import { isPrismaConstraintViolation } from "../../../lib/prisma/constraint-violation.js";
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
type ReminderApplicator = Pick<
  PolicyApplicatorService,
  "applyToPeriod" | "repairToPeriod"
>;

export { PeriodLifecycleIntegrityError } from "./period-factory-lookup.js";

export class PeriodOverlapError extends Error {
  constructor() {
    super("A reporting period overlaps an existing period.");
    this.name = "PeriodOverlapError";
  }
}

// The range exclusion is P2004 through Prisma's engine path and P2039 through
// adapter-pg. Scope every path by constraint identity so unrelated database
// failures still propagate unchanged.
export function isPeriodOverlapConflict(error: unknown): boolean {
  return PRISMA_DATABASE_CONSTRAINT_ERROR_CODES.some((code) =>
    isPrismaConstraintViolation(error, code, {
      index: PERIOD_OVERLAP_CONSTRAINT,
    }),
  );
}

// Best-effort: the period is the durable artifact, so failing to reconcile the
// secondary reminder schedule must NOT fail the caller. The next current-period
// access retries the complete current schedule through the applicator.
async function materialiseReminders(
  applicator: ReminderApplicator,
  reportId: string,
  now: Date,
): Promise<void> {
  try {
    await applicator.applyToPeriod(reportId, now);
  } catch (error) {
    // Constructed here, not at module load: importing this file through the
    // period barrel must stay side-effect-free (a top-level `new Logger()`
    // couples every barrel consumer to Nest logging and breaks mocked tests).
    new Logger("PeriodFactory").warn(
      `applyToPeriod failed for period=${reportId}; the next current-period access will retry reminder reconciliation: ${
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
    await materialiseReminders(args.policyApplicator, created.id, args.now);
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

async function recoverOverlappingCreate(
  report: ReportDelegate,
  periodStart: Date,
  periodEnd: Date,
  anchorDate: Date,
): Promise<EnsuredPeriod> {
  const exactWinner = await readBoundaryPeriod(report, periodStart, periodEnd);
  if (exactWinner) return exactWinner;
  const containingWinner = await readContainingPeriod(report, anchorDate);
  if (containingWinner) return containingWinner;
  throw new PeriodOverlapError();
}

async function repairExistingPeriod(
  applicator: ReminderApplicator | undefined,
  period: EnsuredPeriod,
  now: Date,
): Promise<void> {
  if (applicator && period.deadline !== null) {
    await repairReminders(applicator, period.reportId, now);
  }
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
  if (existing) {
    await repairExistingPeriod(policyApplicator, existing, now);
    return existing;
  }

  const containing = await readContainingPeriod(prisma.report, anchorDate);
  if (containing) {
    await repairExistingPeriod(policyApplicator, containing, now);
    return containing;
  }

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
    // Creators converge on an exact-boundary winner first, then on a manual
    // range that committed around the anchor while this request was creating.
    return recoverOverlappingCreate(
      prisma.report,
      periodStart,
      periodEnd,
      anchorDate,
    );
  }
}

async function repairReminders(
  applicator: Pick<PolicyApplicatorService, "repairToPeriod">,
  reportId: string,
  now: Date,
): Promise<void> {
  try {
    await applicator.repairToPeriod(reportId, now);
  } catch (error) {
    new Logger("PeriodFactory").warn(
      `repairToPeriod failed for period=${reportId}: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

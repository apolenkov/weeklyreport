import type { AppSettings, PeriodState } from "@customreport/shared";
import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";

import {
  computeDeadline,
  getCurrentWeekBounds,
} from "../../../lib/business-date.js";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import type { PolicyApplicatorService } from "../../reminders/policy-applicator.service.js";
import {
  buildTransition,
  initialPeriodState,
} from "../domain/period-transition.js";

/**
 * refactor-auth-exemplary-layering: the single sanctioned period-creation
 * writer. Both creators — the period-creator cron scheduler and the lazy
 * login-create path (`buildUserSession`) — route through here, so there is
 * exactly one formula for the deadline, the lifecycle field set, and the
 * reminder-rule materialisation.
 *
 * It lives INSIDE the `period` module because `period-dual-state` requires
 * every governed `Report` lifecycle write to go through `buildTransition`, and
 * the static raw-write CI gate (`__tests__/lifecycle-write-gate.test.ts`) only
 * accepts the spread form. The factory uses `...buildTransition("create", ...)`,
 * so the three coupled lifecycle representations can never be written apart.
 */

// Wall-clock hour (in the configured timezone) the deadline lands on. Matches
// the period-creator scheduler's hardcoded 18; surfacing it as a setting is
// deferred to a later phase that broadens the deadline-time-of-day surface.
const DEADLINE_HOUR = 18;

// The partial unique index `Report_one_open_per_boundary` (schema/init
// migration) — `ON (periodStart, periodEnd) WHERE periodState='open'` — is the
// constraint two racing creators collide on. Lives in raw SQL, so Prisma's
// P2002 `meta.target` may surface either the index name or the field list.
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
  deadline: Date;
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

/**
 * A `status:"draft"` row is `scheduled` or `open` by the period-dual-state
 * invariant (a reopened period carries `status:"published"`, so it is excluded
 * by the find's `status:"draft"` filter). The DB column is typed as the wider
 * union, so narrow it back at the one place that relies on the invariant.
 */
function narrowDraftState(
  state: PeriodState,
): Extract<PeriodState, "scheduled" | "open"> {
  return state === "scheduled" ? "scheduled" : "open";
}

/**
 * True when `error` is the Prisma `P2002` raised by the partial unique index
 * `Report_one_open_per_boundary`. The violation's identity surfaces in
 * DIFFERENT places depending on the Prisma engine, verified against the real
 * `_test` DB:
 *  - classic engine: `meta.target` carries the colliding field list
 *    (`["periodStart","periodEnd"]`) — the index name is absent;
 *  - pg driver adapter (what this app runs): `meta.target` is UNSET; the index
 *    name lives in `meta.driverAdapterError.cause.originalMessage` and the
 *    columns in `cause.constraint.fields`, with the field list also echoed in
 *    the top-level `message`.
 * So matching only `meta.target` (the obvious shape) silently misses the real
 * adapter error → a raw 500. We scan the whole serialized `meta` + `message`
 * for the precise index name, backstopped by the `periodStart`+`periodEnd`
 * column pair (the classic-engine form where the name is absent). Exported so
 * every open-writer — admin create/update, reopen, unarchive, the scheduler
 * flip, AND the login/scheduler create via `ensureCurrentPeriod` — translates
 * the SAME violation identically; an unrelated unique violation re-throws.
 */
export function isOpenBoundaryConflict(error: unknown): boolean {
  return isUniqueViolation(error, {
    index: OPEN_BOUNDARY_INDEX,
    columns: ["periodStart", "periodEnd"],
  });
}

/**
 * Find-or-create the draft reporting period for the week of `anchorDate`.
 *
 * - `anchorDate` is the date whose week the period covers (the lazy login path
 *   passes `now`; the scheduler passes the day after the most recent period's
 *   end, so it mints the *next* cycle). Bounds come from `getCurrentWeekBounds`.
 * - `now` resolves the initial lifecycle state (`scheduled` before the period's
 *   start day, otherwise `open`) and gates reminder scheduling.
 * - On create (never on find), reminder rules are materialised via
 *   `policyApplicator.applyToPeriod(period, now)`. Passing `now` makes the
 *   applicator drop only the reminder instants that have already elapsed (a
 *   period minted *after* some of its reminders' `fireAt` — a late first-login)
 *   while keeping still-future ones, since the reminders scheduler fires any
 *   active rule whose `fireAt` is already past (no elapsed-`fireAt` guard) and a
 *   stale active rule would blast on the next tick.
 * - Concurrent creators collide on the `Report_one_open_per_boundary` partial
 *   unique index; the loser catches that one P2002, re-reads, and returns the
 *   winner's row. Any other error re-throws.
 */
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

  if (existing) {
    return {
      created: false,
      reportId: existing.id,
      periodStart: existing.periodStart,
      periodEnd: existing.periodEnd,
      deadline: existing.deadline,
      periodState: narrowDraftState(existing.periodState),
    };
  }

  const deadline = computeDeadline(
    periodStart,
    settings.defaultDeadlineDays,
    settings.workingDays,
    settings.defaultTimezone,
    DEADLINE_HOUR,
  );
  const periodState = initialPeriodState(periodStart, now);

  try {
    const created = await prisma.report.create({
      data: {
        periodStart,
        periodEnd,
        deadline,
        ...buildTransition("create", { periodStart, now }),
      },
      select: SELECT_PERIOD,
    });

    // Pass `now` so the applicator drops only already-elapsed reminder instants
    // (a period created after some of its reminders' fireAt — a late first-login)
    // while keeping still-future ones; the reminders scheduler has no
    // elapsed-fireAt guard, so a stale active rule would fire on the next tick.
    //
    // Best-effort: the period is the durable artifact, so a failure to
    // materialise the (secondary) reminder rules must NOT fail the caller — a
    // login must not 500 over reminders, and a cron tick should still record the
    // period. The rows are recoverable via `pnpm db:backfill:reminder-policies`.
    if (policyApplicator) {
      try {
        await policyApplicator.applyToPeriod(
          { id: created.id, deadline: created.deadline },
          now,
        );
      } catch (error) {
        // Constructed here, not at module load: importing this file through the
        // period barrel must stay side-effect-free (a top-level `new Logger()`
        // couples every barrel consumer to Nest logging at load and breaks
        // tests that mock @nestjs/common without a Logger export).
        new Logger("PeriodFactory").warn(
          `applyToPeriod failed for period=${created.id}; reminder rules deferred to backfill: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }

    return {
      created: true,
      reportId: created.id,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      deadline: created.deadline,
      periodState,
    };
  } catch (error) {
    if (!isOpenBoundaryConflict(error)) throw error;

    // Another creator won the race; the winner's applyToPeriod runs in its own
    // call, so we only re-read and return the now-existing open row.
    const won = await prisma.report.findFirst({
      where: { periodStart, periodEnd, periodState: "open" },
      select: SELECT_PERIOD,
    });
    if (!won) throw error;
    return {
      created: false,
      reportId: won.id,
      periodStart: won.periodStart,
      periodEnd: won.periodEnd,
      deadline: won.deadline,
      periodState: narrowDraftState(won.periodState),
    };
  }
}

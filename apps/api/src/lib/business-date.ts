import type { WorkingDays } from "@customreport/shared";
import { DAYS_PER_WEEK } from "@customreport/shared";
import { DateTime } from "luxon";

/**
 * Luxon-based business-day arithmetic.
 *
 * Promotes `workingDays` from cosmetic metadata to actual logic that drives
 * deadline math in Period/cron flows. All functions accept an IANA timezone
 * string and a {@link WorkingDays} policy ("mon-fri" | "mon-sat" | "mon-sun")
 * so the same utility serves Russia (default Mon-Fri), Mon-Sat cultures, and
 * 24/7 operations.
 *
 * DST handling: every computation routes through Luxon's `setZone`, so a
 * `+1 day` step is always a wall-clock day, not a 24h step. Spring-forward
 * and fall-back are handled correctly even when invoked from a UTC `Date`.
 *
 * Future hook: holiday calendars will plug in via an optional
 * `holidays?: ReadonlySet<string>` parameter (ISO date strings in `tz`).
 * The API is kept narrow until then.
 */

/** Iteration budget for business-day walks: ~10 years of daily steps. */
const MAX_ITER_YEARS = 10;
const MAX_DAYS_PER_YEAR = 366;
const MAX_ITER = MAX_DAYS_PER_YEAR * MAX_ITER_YEARS;

// Luxon weekday numbers (1 = Monday … 7 = Sunday).
const MONDAY = 1;
const TUESDAY = 2;
const WEDNESDAY = 3;
const THURSDAY = 4;
const FRIDAY = 5;
const SATURDAY = 6;
const SUNDAY = 7;

/** Wall-clock default matching the legacy hardcoded "+ 18:00" deadline stamp. */
const DEFAULT_DEADLINE_HOUR = 18;
const MAX_HOUR_OF_DAY = 23;

// End-of-day components for the Sunday 23:59:59.999 period boundary.
const LAST_MINUTE = 59;
const LAST_SECOND = 59;
const LAST_MILLISECOND = 999;

/**
 * Returns the Luxon weekday numbers (1=Mon … 7=Sun) that count as business
 * days under the given {@link WorkingDays} policy.
 *
 * @internal — exported for tests only.
 */
export function workingDaySet(wd: WorkingDays): ReadonlySet<number> {
  switch (wd) {
    case "mon-fri":
      return new Set([MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY]);
    case "mon-sat":
      return new Set([MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY]);
    case "mon-sun":
      return new Set([
        MONDAY,
        TUESDAY,
        WEDNESDAY,
        THURSDAY,
        FRIDAY,
        SATURDAY,
        SUNDAY,
      ]);
  }
}

/**
 * Returns true iff `date`, interpreted in `tz`, falls on a business day per
 * `wd`. The wall-clock day in `tz` is what matters — a UTC `Date` that maps
 * to Sunday 23:30 in Europe/Moscow is a Sunday for mon-fri purposes.
 */
export function isBusinessDay(
  date: Date,
  wd: WorkingDays,
  tz: string,
): boolean {
  const dt = DateTime.fromJSDate(date).setZone(tz);
  if (!dt.isValid) {
    throw new Error(`business-date: invalid timezone "${tz}"`);
  }
  return workingDaySet(wd).has(dt.weekday);
}

/**
 * Returns the next business day strictly after `date` (never the same day,
 * even if `date` itself is a business day). Equivalent to
 * `addBusinessDays(date, 1, wd, tz)`.
 */
export function nextBusinessDay(date: Date, wd: WorkingDays, tz: string): Date {
  return addBusinessDays(date, 1, wd, tz);
}

/**
 * Advances `date` by `n` business days in `tz` under policy `wd`.
 *
 * Semantics:
 *   - n > 0: "skip forward N business days"; result is always strictly later.
 *   - n = 0: returned as-is (no normalization to the next business day).
 *     Callers that want "snap to next business day" must use
 *     {@link nextBusinessDay} explicitly.
 *   - n < 0: walks backward by |n| business days (symmetric semantics).
 *
 * Edge cases:
 *   - "mon-sun" (all days are business) → equivalent to `+n` calendar days.
 *   - Throws on invalid timezone strings (Luxon `isValid` check).
 *
 * @throws Error if `tz` is not a recognized IANA zone, or if internal
 *   iteration exceeds {@link MAX_ITER} (safety net; should never fire for
 *   any sane `n`).
 */
export function addBusinessDays(
  date: Date,
  n: number,
  wd: WorkingDays,
  tz: string,
): Date {
  // eslint-disable-next-line no-restricted-syntax -- loop-carried running date; reassigned each step (dt = dt.plus) as the business-day walk advances.
  let dt = DateTime.fromJSDate(date).setZone(tz);
  if (!dt.isValid) {
    throw new Error(`business-date: invalid timezone "${tz}"`);
  }
  if (n === 0) return dt.toJSDate();

  const set = workingDaySet(wd);
  const step = n > 0 ? 1 : -1;
  // eslint-disable-next-line no-restricted-syntax -- business-day counter, decremented as working days are consumed by the walk below.
  let remaining = Math.abs(n);
  // eslint-disable-next-line no-restricted-syntax -- iteration-budget guard, incremented per step to bound the variable-length walk (throws past MAX_ITER).
  let iter = 0;

  while (remaining > 0) {
    if (++iter > MAX_ITER) {
      throw new Error(
        `business-date: addBusinessDays exceeded iteration budget (n=${n}, wd=${wd})`,
      );
    }
    dt = dt.plus({ days: step });
    if (set.has(dt.weekday)) remaining--;
  }
  return dt.toJSDate();
}

/**
 * Computes a Period deadline as a UTC `Date` representing
 * `deadlineHour:00:00.000` wall-clock time in `tz` on the
 * `deadlineDays`-th business day after `periodStart`.
 *
 * The hour/minute/second of `periodStart` are intentionally discarded — the
 * deadline always lands on a clean `HH:00:00.000` boundary in `tz`, matching
 * how reminder rules and the legacy hardcoded "+ 18:00" stamp behaved.
 *
 * Example:
 *   periodStart = Monday 2026-05-04 09:00 Europe/Moscow
 *   deadlineDays = 4, wd = "mon-fri", tz = "Europe/Moscow", hour = 18
 *   → Friday 2026-05-08 18:00 Europe/Moscow → 15:00 UTC
 *
 * @param deadlineHour - 24-hour wall-clock hour in `tz`. Defaults to 18.
 */
export function computeDeadline(
  periodStart: Date,
  deadlineDays: number,
  wd: WorkingDays,
  tz: string,
  deadlineHour = DEFAULT_DEADLINE_HOUR,
): Date {
  if (
    !Number.isInteger(deadlineHour) ||
    deadlineHour < 0 ||
    deadlineHour > MAX_HOUR_OF_DAY
  ) {
    throw new Error(
      `business-date: deadlineHour must be integer 0..23 (got ${deadlineHour})`,
    );
  }
  const shifted = addBusinessDays(periodStart, deadlineDays, wd, tz);
  const dt = DateTime.fromJSDate(shifted).setZone(tz);
  if (!dt.isValid) {
    throw new Error(`business-date: invalid timezone "${tz}"`);
  }
  return dt
    .set({ hour: deadlineHour, minute: 0, second: 0, millisecond: 0 })
    .toJSDate();
}

/**
 * Monday 00:00:00.000 UTC and Sunday 23:59:59.999 UTC for the week containing
 * `date`. UTC-only arithmetic — independent of host TZ and DST, so the same
 * call at 23:00 Moscow Sunday and 22:00 UTC Sunday produces identical bounds.
 * Fixes naive `setDate`/`setHours` drift across DST transitions and
 * TZ-mismatched containers.
 *
 * When `periodLengthDays` is provided, `periodEnd` is
 * anchored to Monday + (length - 1) days at 23:59:59.999 UTC instead of the
 * hardcoded 7-day Mon-Sun span. Callers that don't pass the argument keep the
 * original Mon-Sun (length=7) behaviour.
 *
 * Kept as hand-rolled `Date.UTC` arithmetic rather than rewritten in Luxon —
 * it is correct and tested, and a rewrite would be unrequested scope that
 * risks a regression in a function the scheduler depends on.
 */
export function getCurrentWeekBounds(
  date: Date = new Date(),
  periodLengthDays = DAYS_PER_WEEK,
): {
  periodStart: Date;
  periodEnd: Date;
} {
  if (!Number.isInteger(periodLengthDays) || periodLengthDays <= 0) {
    throw new Error(
      `business-date: periodLengthDays must be a positive integer (got ${periodLengthDays})`,
    );
  }
  const utcDay = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Monday is the start-of-week. Sunday (0) maps to "6 days back".
  const diffToMonday = utcDay === 0 ? 1 - DAYS_PER_WEEK : 1 - utcDay;

  const periodStart = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + diffToMonday,
      0,
      0,
      0,
      0,
    ),
  );
  const periodEnd = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + diffToMonday + (periodLengthDays - 1),
      MAX_HOUR_OF_DAY,
      LAST_MINUTE,
      LAST_SECOND,
      LAST_MILLISECOND,
    ),
  );

  return { periodStart, periodEnd };
}

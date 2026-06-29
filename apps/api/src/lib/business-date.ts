import type { WorkingDays } from "@customreport/shared";
import { DateTime } from "luxon";

/**
 * Phase 50-C (UFB-050): Luxon-based business-day arithmetic.
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
 * Future hook (Phase 51-A): Holiday calendars will plug in via an optional
 * `holidays?: ReadonlySet<string>` parameter (ISO date strings in `tz`).
 * For 50-C the API is kept narrow; the parameter is added when 51-A lands.
 */

const MAX_ITER = 366 * 10;

/**
 * Returns the Luxon weekday numbers (1=Mon … 7=Sun) that count as business
 * days under the given {@link WorkingDays} policy.
 *
 * @internal — exported for tests only.
 */
export function workingDaySet(wd: WorkingDays): ReadonlySet<number> {
  switch (wd) {
    case "mon-fri":
      return new Set([1, 2, 3, 4, 5]);
    case "mon-sat":
      return new Set([1, 2, 3, 4, 5, 6]);
    case "mon-sun":
      return new Set([1, 2, 3, 4, 5, 6, 7]);
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
  let dt = DateTime.fromJSDate(date).setZone(tz);
  if (!dt.isValid) {
    throw new Error(`business-date: invalid timezone "${tz}"`);
  }
  if (n === 0) return dt.toJSDate();

  const set = workingDaySet(wd);
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
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
  deadlineHour = 18,
): Date {
  if (
    !Number.isInteger(deadlineHour) ||
    deadlineHour < 0 ||
    deadlineHour > 23
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
 * Phase 32-M7 (M-07) — fixes naive `setDate`/`setHours` drift across DST
 * transitions and TZ-mismatched containers.
 *
 * UFB-048 / Phase 50-A: when `periodLengthDays` is provided, `periodEnd` is
 * anchored to Monday + (length - 1) days at 23:59:59.999 UTC instead of the
 * hardcoded 7-day Mon-Sun span. Callers that don't pass the argument keep the
 * original Mon-Sun (length=7) behaviour.
 *
 * refactor-auth-exemplary-layering: moved here from `modules/auth/auth.routes.ts`
 * so it sits next to the rest of the period/deadline date vocabulary and both
 * the period-creator scheduler and the period factory import it from one place
 * (the `period → auth` import is gone). Kept as hand-rolled `Date.UTC`
 * arithmetic rather than rewritten in Luxon — it is correct and tested, and a
 * rewrite would be unrequested scope that risks a regression in a function the
 * scheduler depends on.
 */
export function getCurrentWeekBounds(
  date: Date = new Date(),
  periodLengthDays = 7,
): {
  periodStart: Date;
  periodEnd: Date;
} {
  const utcDay = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Monday is the start-of-week. Sunday (0) maps to "6 days back".
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;

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
      23,
      59,
      59,
      999,
    ),
  );

  return { periodStart, periodEnd };
}

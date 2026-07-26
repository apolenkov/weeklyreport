import type { WorkingDays } from "@customreport/shared";
import { DAYS_PER_WEEK } from "@customreport/shared";
import { DateTime } from "luxon";

// Luxon wall-clock days via setZone — not 24h steps — so DST is correct
// from a UTC Date. WorkingDays policy is mon-fri | mon-sat | mon-sun.

// Iteration budget for business-day walks: ~10 years of daily steps.
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

// Default wall-clock deadline hour (legacy product convention).
const DEFAULT_DEADLINE_HOUR = 18;
const MAX_HOUR_OF_DAY = 23;

// Exported for tests only.
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

// Wall-clock day in tz matters — not the UTC calendar day of the Date.
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

export function nextBusinessDay(date: Date, wd: WorkingDays, tz: string): Date {
  return addBusinessDays(date, 1, wd, tz);
}

// n=0 is as-is (no snap); use nextBusinessDay to land on a business day.
// n≠0 walks strictly forward/back by |n| business days.
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

// Discards periodStart clock time — deadline always lands on HH:00:00 in tz.
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

// The explicit utc zone — not the host clock — anchors the Monday
// (scheduler-critical); luxon's ISO week already starts on Monday.
// Optional periodLengthDays ends at Monday+(length-1); default is Mon–Sun.
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
  const monday = DateTime.fromJSDate(date, { zone: "utc" }).startOf("week");

  return {
    periodStart: monday.toJSDate(),
    periodEnd: monday
      .plus({ days: periodLengthDays - 1 })
      .endOf("day")
      .toJSDate(),
  };
}

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

const DEADLINE_TIME_PATTERN = /^(?<hour>[01]\d|2[0-3]):(?<minute>[0-5]\d)$/;

export interface DeadlineTime {
  readonly hour: number;
  readonly minute: number;
}

export function parseDeadlineTime(value: string): DeadlineTime {
  const match = DEADLINE_TIME_PATTERN.exec(value);
  if (!match?.groups) {
    throw new Error(
      `business-date: deadlineTime must use HH:MM (got ${JSON.stringify(value)})`,
    );
  }
  return {
    hour: Number(match.groups.hour),
    minute: Number(match.groups.minute),
  };
}

function workingDaySet(wd: WorkingDays): ReadonlySet<number> {
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

// n=0 is as-is (no snap).
// n≠0 walks strictly forward/back by |n| business days.
export function addBusinessDays(
  date: Date,
  n: number,
  wd: WorkingDays,
  tz: string,
): Date {
  const dt = DateTime.fromJSDate(date).setZone(tz);
  if (!dt.isValid) {
    throw new Error(`business-date: invalid timezone "${tz}"`);
  }
  if (n === 0) return dt.toJSDate();

  const set = workingDaySet(wd);
  const step = n > 0 ? 1 : -1;
  const result = Array.from({ length: MAX_ITER }, (_, index) =>
    dt.plus({ days: step * (index + 1) }),
  ).filter((candidate) => set.has(candidate.weekday))[Math.abs(n) - 1];
  if (result === undefined) {
    throw new Error(
      `business-date: addBusinessDays exceeded iteration budget (n=${n}, wd=${wd})`,
    );
  }
  return result.toJSDate();
}

// Discards periodStart clock time and applies an explicit wall-clock time in tz.
// deadlineTime is required: the 18:00 product default lives in period settings
// (AppSettings.deadlineTime), not here — a generic helper must not embed it.
export function computeDeadline(
  periodStart: Date,
  deadlineDays: number,
  wd: WorkingDays,
  tz: string,
  deadlineTime: DeadlineTime,
): Date {
  const shifted = addBusinessDays(periodStart, deadlineDays, wd, tz);
  const dt = DateTime.fromJSDate(shifted).setZone(tz);
  if (!dt.isValid) {
    throw new Error(`business-date: invalid timezone "${tz}"`);
  }
  return dt.set({ ...deadlineTime, second: 0, millisecond: 0 }).toJSDate();
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
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(
      `business-date: input date must be valid (got ${String(date)})`,
    );
  }
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

// The current week (open), the previous week (published) and three history
// weeks, derived from the run time — a hardcoded date would drift into the past
// and leave the current-week section blank on the page the lead opens.

import {
  ACTIVE_REPORT_ID,
  HISTORY_REPORT_2_ID,
  HISTORY_REPORT_3_ID,
  HISTORY_REPORT_4_ID,
  PUBLISHED_REPORT_ID,
} from "./seed-identifiers.js";
import { seedReferenceDate } from "./seed-reference-date.js";

export interface SeedHistoryReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  deadline: string;
  weekLabel: string;
  archived: boolean;
}

const DAYS_PER_WEEK = 7;
// 24 * 60 * 60 * 1000 and 7 * that. Written as literals because every operand
// of the product would otherwise be an unnamed number.
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 604_800_000;

// Monday-based day index: getUTCDay() is Sunday-based, so shifting by 6 before
// the modulo maps Monday to 0 and Sunday to 6.
const SUNDAY_TO_MONDAY_SHIFT = 6;
// ISO-8601 anchors: week 1 is the week holding the first Thursday, and Jan 4
// is by definition always inside it.
const ISO_THURSDAY_INDEX = 3;
const ISO_WEEK_ONE_SEED_DAY = 4;

// A period runs Monday..Sunday and is due Friday 15:00 UTC.
const PERIOD_LAST_DAY_OFFSET = 6;
const DEADLINE_DAY_OFFSET_FROM_MONDAY = 4;
const DEADLINE_HOUR_UTC = 15;

const LAST_HOUR_OF_DAY = 23;
const LAST_MINUTE_OF_HOUR = 59;
const LAST_SECOND_OF_MINUTE = 59;
const LAST_MILLISECOND_OF_SECOND = 999;

function utcMidnight(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function mondayBasedDayIndex(d: Date): number {
  return (d.getUTCDay() + SUNDAY_TO_MONDAY_SHIFT) % DAYS_PER_WEEK;
}

function plusDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function mondayOfWeek(d: Date): Date {
  return plusDays(utcMidnight(d), -mondayBasedDayIndex(d));
}

function weekBefore(monday: Date): Date {
  return plusDays(monday, -DAYS_PER_WEEK);
}

// Shifting both the date and the year's first ISO week onto their own Thursday
// makes the week distance a plain division.
function thursdayOfWeek(d: Date): Date {
  return plusDays(utcMidnight(d), ISO_THURSDAY_INDEX - mondayBasedDayIndex(d));
}

function isoWeekNumber(d: Date): number {
  const thursday = thursdayOfWeek(d);
  const weekOneThursday = thursdayOfWeek(
    new Date(Date.UTC(thursday.getUTCFullYear(), 0, ISO_WEEK_ONE_SEED_DAY)),
  );
  return (
    1 +
    Math.round((thursday.getTime() - weekOneThursday.getTime()) / MS_PER_WEEK)
  );
}

function endOfDay(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      LAST_HOUR_OF_DAY,
      LAST_MINUTE_OF_HOUR,
      LAST_SECOND_OF_MINUTE,
      LAST_MILLISECOND_OF_SECOND,
    ),
  );
}

function periodEnd(monday: Date): string {
  return endOfDay(plusDays(monday, PERIOD_LAST_DAY_OFFSET)).toISOString();
}

function weeklyDeadline(monday: Date): string {
  const friday = plusDays(monday, DEADLINE_DAY_OFFSET_FROM_MONDAY);
  return new Date(
    Date.UTC(
      friday.getUTCFullYear(),
      friday.getUTCMonth(),
      friday.getUTCDate(),
      DEADLINE_HOUR_UTC,
      0,
      0,
    ),
  ).toISOString();
}

function weekLabel(monday: Date): string {
  return `Week ${isoWeekNumber(monday)}`;
}

// Periods derive from an explicit reference instant (SEED_REFERENCE_DATE, or
// today when unset as a documented dev convenience) so the same seed commit
// cannot change identity across days or at a week boundary.
const NOW = seedReferenceDate();
const ACTIVE_MONDAY = mondayOfWeek(NOW);
const PREV_MONDAY = weekBefore(ACTIVE_MONDAY);
const PREV2_MONDAY = weekBefore(PREV_MONDAY);
const PREV3_MONDAY = weekBefore(PREV2_MONDAY);
const PREV4_MONDAY = weekBefore(PREV3_MONDAY);

export const SEED_REPORTS = {
  active: {
    id: ACTIVE_REPORT_ID,
    periodStart: ACTIVE_MONDAY.toISOString(),
    periodEnd: periodEnd(ACTIVE_MONDAY),
    deadline: weeklyDeadline(ACTIVE_MONDAY),
    weekLabel: weekLabel(ACTIVE_MONDAY),
    periodStatus: "open" as const,
    status: "draft" as const,
  },
  published: {
    id: PUBLISHED_REPORT_ID,
    periodStart: PREV_MONDAY.toISOString(),
    periodEnd: periodEnd(PREV_MONDAY),
    deadline: weeklyDeadline(PREV_MONDAY),
    weekLabel: weekLabel(PREV_MONDAY),
    periodStatus: "published" as const,
    status: "published" as const,
    publishedAt: periodEnd(PREV_MONDAY),
  },
} as const;

// Weeks N-2, N-3 and N-4; the two oldest are archived.
export const SEED_HISTORY_REPORTS: readonly SeedHistoryReport[] = [
  {
    id: HISTORY_REPORT_2_ID,
    periodStart: PREV2_MONDAY.toISOString(),
    periodEnd: periodEnd(PREV2_MONDAY),
    deadline: weeklyDeadline(PREV2_MONDAY),
    weekLabel: weekLabel(PREV2_MONDAY),
    archived: false,
  },
  {
    id: HISTORY_REPORT_3_ID,
    periodStart: PREV3_MONDAY.toISOString(),
    periodEnd: periodEnd(PREV3_MONDAY),
    deadline: weeklyDeadline(PREV3_MONDAY),
    weekLabel: weekLabel(PREV3_MONDAY),
    archived: true,
  },
  {
    id: HISTORY_REPORT_4_ID,
    periodStart: PREV4_MONDAY.toISOString(),
    periodEnd: periodEnd(PREV4_MONDAY),
    deadline: weeklyDeadline(PREV4_MONDAY),
    weekLabel: weekLabel(PREV4_MONDAY),
    archived: true,
  },
] as const;

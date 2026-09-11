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
import {
  endOfDayUTC,
  fridayDeadlineFor,
  isoWeekNumber,
  LAST_DAY_OF_WEEK_OFFSET,
  mondayOfWeekUTC,
  plusDaysUTC,
} from "./utc-period-dates.js";

export interface SeedHistoryReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  deadline: string;
  weekLabel: string;
  archived: boolean;
}

const DAYS_PER_WEEK = 7;

function weekBefore(monday: Date): Date {
  return plusDaysUTC(monday, -DAYS_PER_WEEK);
}

function periodEnd(monday: Date): string {
  return endOfDayUTC(
    plusDaysUTC(monday, LAST_DAY_OF_WEEK_OFFSET),
  ).toISOString();
}

function weeklyDeadline(monday: Date): string {
  return fridayDeadlineFor(monday).toISOString();
}

function weekLabel(monday: Date): string {
  return `Week ${isoWeekNumber(monday)}`;
}

// An explicit SEED_REFERENCE_DATE makes periods repeatable. When it is unset,
// current time keeps local development data aligned with the active week.
const NOW = seedReferenceDate();
const ACTIVE_MONDAY = mondayOfWeekUTC(NOW);
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

import { PeriodStatus, ReportStatus } from "@prisma/client";

const DAYS_PER_WEEK = 7;
// Shifts JS's Sunday=0 week onto the ISO Monday=0 week.
const MONDAY_FIRST_SHIFT = 6;
export const LAST_DAY_OF_WEEK_OFFSET = 6;
// Sections are seeded as submitted on the Thursday of their period.
export const SUBMIT_DAY_OFFSET = 3;
const THURSDAY_OFFSET = 3;
const FRIDAY_OFFSET = 4;
const DEADLINE_HOUR_UTC = 15;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;
const LAST_SECOND = 59;
// ISO 8601: week 1 is the week containing January 4th.
const ISO_FIRST_WEEK_DAY_OF_YEAR = 4;
const MS_PER_WEEK = 604_800_000;
const ESCALATION_HOURS_AFTER_DEADLINE = 2;

// The active period is anchored to the *current* UTC week so weeklyReport.get
// always finds an open report covering today; a static window would drift into
// the past and every page load would fail with 'No active report period found'.
// Mirrors the derivation in prisma/seed-periods.ts so both seeds agree.
function mondayOfWeekUTC(d: Date): Date {
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (monday.getUTCDay() + MONDAY_FIRST_SHIFT) % DAYS_PER_WEEK;
  monday.setUTCDate(monday.getUTCDate() - dayNum);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export function plusDaysUTC(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function endOfDayUTC(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(LAST_HOUR, LAST_MINUTE, LAST_SECOND, 0);
  return r;
}

export function isoWeekNumber(d: Date): number {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (t.getUTCDay() + MONDAY_FIRST_SHIFT) % DAYS_PER_WEEK;
  // Both dates shift to the Thursday of their week, which is what makes the
  // week difference below exact.
  t.setUTCDate(t.getUTCDate() - dayNum + THURSDAY_OFFSET);
  const firstThursday = new Date(
    Date.UTC(t.getUTCFullYear(), 0, ISO_FIRST_WEEK_DAY_OF_YEAR),
  );
  const firstThursdayDayNum =
    (firstThursday.getUTCDay() + MONDAY_FIRST_SHIFT) % DAYS_PER_WEEK;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayNum + THURSDAY_OFFSET,
  );
  return 1 + Math.round((t.getTime() - firstThursday.getTime()) / MS_PER_WEEK);
}

// Submission deadline: Friday 15:00 UTC of the given week.
export function fridayDeadlineFor(monday: Date): Date {
  const friday = plusDaysUTC(monday, FRIDAY_OFFSET);
  return new Date(
    Date.UTC(
      friday.getUTCFullYear(),
      friday.getUTCMonth(),
      friday.getUTCDate(),
      DEADLINE_HOUR_UTC,
      0,
      0,
      0,
    ),
  );
}

export const ACTIVE_MONDAY = mondayOfWeekUTC(new Date());
export const ACTIVE_SUNDAY = endOfDayUTC(
  plusDaysUTC(ACTIVE_MONDAY, LAST_DAY_OF_WEEK_OFFSET),
);
export const ACTIVE_FRIDAY_DEADLINE = fridayDeadlineFor(ACTIVE_MONDAY);
export const PREV_MONDAY = plusDaysUTC(ACTIVE_MONDAY, -DAYS_PER_WEEK);
export const PREV_SUNDAY = endOfDayUTC(
  plusDaysUTC(PREV_MONDAY, LAST_DAY_OF_WEEK_OFFSET),
);
export const PREV_FRIDAY_DEADLINE = fridayDeadlineFor(PREV_MONDAY);
export const PREV_SUBMIT_AT = plusDaysUTC(PREV_MONDAY, SUBMIT_DAY_OFFSET);

export const ACTIVE_REMINDER_DEADLINE_FIRE = new Date(ACTIVE_FRIDAY_DEADLINE);
export const ACTIVE_REMINDER_ESCALATION_FIRE = (() => {
  const r = new Date(ACTIVE_FRIDAY_DEADLINE);
  r.setUTCHours(r.getUTCHours() + ESCALATION_HOURS_AFTER_DEADLINE);
  return r;
})();

export interface ExtraReportSeed {
  id: string;
  monday: Date;
  status: ReportStatus;
  periodStatus: PeriodStatus;
  publishedAt?: Date;
}

// Deterministic ids, ordered oldest → newest; the offsets are derived from the
// position in each list so the two blocks stay contiguous with PREV_MONDAY.
const PUBLISHED_HISTORY_IDS = [
  "a0000000-0000-4000-8000-000000000003",
  "a0000000-0000-4000-8000-000000000004",
  "a0000000-0000-4000-8000-000000000005",
  "a0000000-0000-4000-8000-000000000006",
];
const FUTURE_PERIOD_IDS = [
  "a0000000-0000-4000-8000-000000000007",
  "a0000000-0000-4000-8000-000000000008",
];

// Extra historical + future periods so the Periods admin tab and /reports
// archive show realistic data instead of a 1-row "0/1 Submission" dashboard.
// Historical = published (deeper history), future = open (upcoming-week preview).
export const EXTRA_REPORTS: ExtraReportSeed[] = [
  ...PUBLISHED_HISTORY_IDS.map((id, idx) => {
    const weeksBeforePrev = PUBLISHED_HISTORY_IDS.length - idx;
    const monday = plusDaysUTC(PREV_MONDAY, -weeksBeforePrev * DAYS_PER_WEEK);
    return {
      id,
      monday,
      status: ReportStatus.published,
      periodStatus: PeriodStatus.published,
      publishedAt: endOfDayUTC(plusDaysUTC(monday, LAST_DAY_OF_WEEK_OFFSET)),
    };
  }),
  ...FUTURE_PERIOD_IDS.map((id, idx) => ({
    id,
    monday: plusDaysUTC(ACTIVE_MONDAY, (idx + 1) * DAYS_PER_WEEK),
    status: ReportStatus.draft,
    periodStatus: PeriodStatus.open,
  })),
];

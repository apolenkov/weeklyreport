import { PeriodStatus, ReportStatus } from "@prisma/client";

import { seedReferenceDate } from "../support/seed-reference-date.js";
import {
  endOfDayUTC,
  fridayDeadlineFor,
  isoWeekNumber,
  LAST_DAY_OF_WEEK_OFFSET,
  mondayOfWeekUTC,
  plusDaysUTC,
} from "../support/utc-period-dates.js";

const DAYS_PER_WEEK = 7;
// Sections are seeded as submitted on the Thursday of their period.
export const SUBMIT_DAY_OFFSET = 3;

export {
  endOfDayUTC,
  fridayDeadlineFor,
  isoWeekNumber,
  LAST_DAY_OF_WEEK_OFFSET,
  plusDaysUTC,
};

export const ACTIVE_MONDAY = mondayOfWeekUTC(seedReferenceDate());
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
// Historical rows are canonically published. Future rows are canonically
// scheduled while their companion periodStatus remains open.
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

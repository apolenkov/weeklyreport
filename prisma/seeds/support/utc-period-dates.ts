const DAYS_PER_WEEK = 7;
const MONDAY_FIRST_SHIFT = 6;
const THURSDAY_OFFSET = 3;
const FRIDAY_OFFSET = 4;
const DEADLINE_HOUR_UTC = 15;
const LAST_HOUR = 23;
const LAST_MINUTE_OR_SECOND = 59;
const LAST_MILLISECOND = 999;
const ISO_FIRST_WEEK_DAY_OF_YEAR = 4;
const MS_PER_WEEK = 604_800_000;

export const LAST_DAY_OF_WEEK_OFFSET = 6;

export function plusDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function mondayOfWeekUTC(date: Date): Date {
  const monday = new Date(date);
  monday.setUTCHours(0, 0, 0, 0);
  const dayIndex = (monday.getUTCDay() + MONDAY_FIRST_SHIFT) % DAYS_PER_WEEK;
  monday.setUTCDate(monday.getUTCDate() - dayIndex);
  return monday;
}

export function endOfDayUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(
    LAST_HOUR,
    LAST_MINUTE_OR_SECOND,
    LAST_MINUTE_OR_SECOND,
    LAST_MILLISECOND,
  );
  return result;
}

export function isoWeekNumber(date: Date): number {
  const thursday = mondayOfWeekUTC(date);
  thursday.setUTCDate(thursday.getUTCDate() + THURSDAY_OFFSET);
  const firstThursday = new Date(thursday);
  firstThursday.setUTCFullYear(
    thursday.getUTCFullYear(),
    0,
    ISO_FIRST_WEEK_DAY_OF_YEAR,
  );
  const firstThursdayDayIndex =
    (firstThursday.getUTCDay() + MONDAY_FIRST_SHIFT) % DAYS_PER_WEEK;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayIndex + THURSDAY_OFFSET,
  );
  return (
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / MS_PER_WEEK)
  );
}

export function fridayDeadlineFor(monday: Date): Date {
  const friday = plusDaysUTC(monday, FRIDAY_OFFSET);
  friday.setUTCHours(DEADLINE_HOUR_UTC, 0, 0, 0);
  return friday;
}

/**
 * Shared date formatting utilities.
 * All dates use 'ru-RU' locale. Period dates (periodStart, periodEnd)
 * include timeZone: 'UTC' to prevent off-by-one day shifts in UTC+N timezones.
 */

import {
  DAYS_PER_WEEK,
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  MS_PER_WEEK,
  SECONDS_PER_MINUTE,
} from "@customreport/shared";

type DateInput = Date | string | null | undefined;
export type RelativePastVariant = "compact" | "long" | "activity";

// ISO-8601 week numbering: week 1 is the week containing the year's first
// Thursday (equivalently, the week containing Jan 4). Shifting a date to the
// Thursday of its week makes the year-boundary weeks resolve correctly.
const ISO_PIVOT_WEEKDAY_OFFSET = 3;
const ISO_PIVOT_JANUARY_DAY = 4;
const ACTIVITY_JUST_NOW_THRESHOLD_SECONDS = 30;

/** Format a date for display (ru-RU locale, medium style). */
export function formatDate(date: DateInput): string {
  if (!date) return "\u2014";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ru-RU", { dateStyle: "medium" });
}

/** Format a date with time (ru-RU locale, short date + short time). */
export function formatDateTime(date: DateInput): string {
  if (!date) return "\u2014";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Format a report period date (ru-RU locale, UTC timezone).
 * Period dates are stored as midnight UTC -- without timeZone: 'UTC',
 * users in UTC+N timezones see the previous day.
 */
export function formatPeriodDate(date: DateInput): string {
  if (!date) return "\u2014";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ru-RU", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Short English month labels, indexed by `getUTCMonth()`. The single home for
 * short-date rendering (web-shared-idioms); a month-label correction here
 * propagates to every consuming surface.
 */
export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Short "Mon D" timestamp in UTC (e.g. "Apr 18"). UTC accessors keep the label
 * timezone-stable, matching the period-range formatters above.
 */
export function formatTimestampShort(date: Date): string {
  return `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function formatRelativeHours(
  hours: number,
  variant: RelativePastVariant,
): string {
  if (variant === "long") {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  return hours === 1 ? "1h ago" : `${hours}h ago`;
}

export function formatRelativePast(
  date: Date,
  now: Date,
  variant: RelativePastVariant = "compact",
): string {
  const diffSeconds = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / MS_PER_SECOND),
  );
  if (
    variant === "activity" &&
    diffSeconds >= ACTIVITY_JUST_NOW_THRESHOLD_SECONDS &&
    diffSeconds < SECONDS_PER_MINUTE
  ) {
    return `${diffSeconds}s ago`;
  }
  if (diffSeconds < SECONDS_PER_MINUTE) return "just now";
  const minutes = Math.floor(diffSeconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min ago`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return formatRelativeHours(hours, variant);
  if (variant !== "activity") return formatTimestampShort(date);
  const days = Math.floor(hours / HOURS_PER_DAY);
  return days < DAYS_PER_WEEK
    ? `${days}d ago`
    : date.toLocaleDateString("en-US", { timeZone: "UTC" });
}

function toDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}

export function isoWeekNumber(date: Date | string): number {
  const d = toDate(date);
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (target.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  target.setUTCDate(target.getUTCDate() - dayNum + ISO_PIVOT_WEEKDAY_OFFSET);
  const firstThursday = new Date(
    Date.UTC(target.getUTCFullYear(), 0, ISO_PIVOT_JANUARY_DAY),
  );
  const firstThursdayDayNum =
    (firstThursday.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayNum + ISO_PIVOT_WEEKDAY_OFFSET,
  );
  const diffMs = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diffMs / MS_PER_WEEK);
}

export function formatWeekLabel(date: Date | string): string {
  return `Week ${isoWeekNumber(date)}`;
}

/**
 * Format a period date range for display: "May 11\u201317" (same month) or
 * "May 11\u2013Jun 3" (cross-month). Uses UTC getUTC* accessors to prevent
 * off-by-one day shifts for users in UTC+N timezones.
 */
export function formatPeriodRange(start: DateInput, end: DateInput): string {
  if (!start || !end) return "\u2014";
  const s = toDate(start);
  const e = toDate(end);
  const sMonth = MONTHS_SHORT[s.getUTCMonth()];
  const sDay = s.getUTCDate();
  const eMonth = MONTHS_SHORT[e.getUTCMonth()];
  const eDay = e.getUTCDate();
  if (s.getUTCMonth() === e.getUTCMonth()) {
    return `${sMonth} ${sDay}\u2013${eDay}`;
  }
  return `${sMonth} ${sDay}\u2013${eMonth} ${eDay}`;
}

export function formatPeriodRangeWithYear(
  start: DateInput,
  end: DateInput,
): string {
  if (!start || !end) return "\u2014";
  const s = toDate(start);
  const e = toDate(end);
  const sMonth = MONTHS_SHORT[s.getUTCMonth()];
  const eMonth = MONTHS_SHORT[e.getUTCMonth()];
  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const eYear = e.getUTCFullYear();
  if (
    s.getUTCMonth() === e.getUTCMonth() &&
    s.getUTCFullYear() === e.getUTCFullYear()
  ) {
    return `${sMonth} ${sDay}–${eDay}, ${eYear}`;
  }
  if (s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${sMonth} ${sDay}–${eMonth} ${eDay}, ${eYear}`;
  }
  return `${sMonth} ${sDay}, ${s.getUTCFullYear()}–${eMonth} ${eDay}, ${eYear}`;
}

export function formatPeriodLabel(start: DateInput, end: DateInput): string {
  if (!start || !end) return "Period unavailable";
  return `${formatWeekLabel(start)}, ${formatPeriodRangeWithYear(start, end)}`;
}

export function joinPeriodLabel(
  weekLabel: string | null | undefined,
  dateRange: string | null | undefined,
): string {
  const week = weekLabel?.trim();
  const range = dateRange?.trim();
  if (week && range) return `${week}, ${range}`;
  return week || range || "Period unavailable";
}

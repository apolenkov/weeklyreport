/**
 * Shared date formatting utilities.
 * All dates use 'ru-RU' locale. Period dates (periodStart, periodEnd)
 * include timeZone: 'UTC' to prevent off-by-one day shifts in UTC+N timezones.
 */

/** Format a date for display (ru-RU locale, medium style). */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "\u2014";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ru-RU", { dateStyle: "medium" });
}

/** Format a date with time (ru-RU locale, short date + short time). */
export function formatDateTime(date: Date | string | null | undefined): string {
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
export function formatPeriodDate(
  date: Date | string | null | undefined,
): string {
  if (!date) return "\u2014";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ru-RU", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const MONTHS_SHORT = [
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

function toDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}

export function isoWeekNumber(date: Date | string): number {
  const d = toDate(date);
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayNum + 3,
  );
  const diffMs = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

export function formatWeekLabel(date: Date | string): string {
  return `Week ${isoWeekNumber(date)}`;
}

/**
 * Format a period date range for display: "May 11\u201317" (same month) or
 * "May 11\u2013Jun 3" (cross-month). Uses UTC getUTC* accessors to prevent
 * off-by-one day shifts for users in UTC+N timezones.
 */
export function formatPeriodRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
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
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
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

export function formatPeriodLabel(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
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

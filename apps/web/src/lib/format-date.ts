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
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);
  const sMonth = MONTHS_SHORT[s.getUTCMonth()];
  const sDay = s.getUTCDate();
  const eMonth = MONTHS_SHORT[e.getUTCMonth()];
  const eDay = e.getUTCDate();
  if (s.getUTCMonth() === e.getUTCMonth()) {
    return `${sMonth} ${sDay}\u2013${eDay}`;
  }
  return `${sMonth} ${sDay}\u2013${eMonth} ${eDay}`;
}

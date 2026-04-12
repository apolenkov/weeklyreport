/**
 * Shared date formatting utilities.
 * All dates use 'ru-RU' locale. Period dates (periodStart, periodEnd)
 * include timeZone: 'UTC' to prevent off-by-one day shifts in UTC+N timezones.
 */

/** Format a date for display (ru-RU locale, medium style). */
export function formatDate(
  date: Date | string | null | undefined,
): string {
  if (!date) return '\u2014';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('ru-RU', { dateStyle: 'medium' });
}

/** Format a date with time (ru-RU locale, short date + short time). */
export function formatDateTime(
  date: Date | string | null | undefined,
): string {
  if (!date) return '\u2014';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
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
  if (!date) return '\u2014';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('ru-RU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

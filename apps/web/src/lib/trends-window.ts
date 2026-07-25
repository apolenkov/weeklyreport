/**
 * Rolling 12-month window (UTC, YYYY-MM-DD) anchored on `now` — a pinned
 * calendar window drifts behind the ever-advancing report set and silently
 * empties the charts. The day-of-month is clamped to the target month's
 * length so a Feb 29 anchor maps to the prior year's Feb 28 instead of
 * JS-date-overflowing into Mar 1 and dropping the window's oldest report.
  * @param now - The now argument.
 */
export function deriveTrendsWindow(now: Date): {
  periodFrom: string;
  periodTo: string;
} {
  const fromYear = now.getUTCFullYear() - 1;
  const month = now.getUTCMonth();
  // Day 0 of the NEXT month = last day of the target month.
  const lastDayOfTargetMonth = new Date(
    Date.UTC(fromYear, month + 1, 0),
  ).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDayOfTargetMonth);
  const from = new Date(Date.UTC(fromYear, month, day));
  return { periodFrom: formatDate(from), periodTo: formatDate(now) };
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear().toString();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

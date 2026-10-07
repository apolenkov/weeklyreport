import { DAYS_PER_WEEK } from "@customreport/shared";

import { toIsoDateString } from "../../../shared/lib/format/format-date";

const ISO_DATETIME_LOCAL_LENGTH = 16;
const NEXT_MONDAY_OFFSET_BASE = DAYS_PER_WEEK + 1;

// Scheduler-aligned default start date. Manual periods are not restricted to
// Mondays; this only keeps the untouched create dialog on the weekly cadence.
export function nextMonday(from: Date): string {
  // getUTCDay: 0=Sun, 1=Mon..6=Sat. For Sun add 1 day; for any other
  // weekday add (NEXT_MONDAY_OFFSET_BASE - day) % DAYS_PER_WEEK days. For
  // Monday this evaluates to 0 → returns `from`'s own date.
  const day = from.getUTCDay();
  const offset =
    day === 0 ? 1 : (NEXT_MONDAY_OFFSET_BASE - day) % DAYS_PER_WEEK;
  // Date.UTC normalises the day overflow and pins the time to UTC midnight.
  const monday = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate() + offset,
    ),
  );
  // Render as `YYYY-MM-DD` for the <input type="date"> value.
  return toIsoDateString(monday);
}

// `<input type="datetime-local">` value, UTC wall-clock on read and write —
// handleSubmit parses it back with an explicit `:00.000Z`. A bare
// `new Date(value)` would read local time and drift a non-UTC admin's deadline.
export function dateTimeInputValue(d: Date): string {
  return d.toISOString().slice(0, ISO_DATETIME_LOCAL_LENGTH);
}

// Deadline must fall within [periodStart, periodEnd] when both are set. Parses
// as UTC wall-clock to match the submit parse and the UTC-parsed bounds.
export function computeDeadlineError(args: {
  readonly deadline: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}): string | null {
  const { deadline, periodStart, periodEnd } = args;
  if (!deadline) return null;
  const dl = new Date(`${deadline}:00.000Z`);
  // An unparseable value otherwise turns every bound comparison into a NaN
  // comparison (all false) and sails through to the server as garbage input.
  if (Number.isNaN(dl.getTime())) return "Enter a valid deadline.";
  if (periodStart) {
    const start = new Date(`${periodStart}T00:00:00.000Z`);
    if (dl < start) return "Deadline cannot be before period start.";
  }
  if (periodEnd) {
    const end = new Date(`${periodEnd}T23:59:59.999Z`);
    if (dl > end) return "Deadline cannot be after period end.";
  }
  return null;
}

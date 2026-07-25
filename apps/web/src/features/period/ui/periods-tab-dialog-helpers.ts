import { DAYS_PER_WEEK } from "@customreport/shared";

const ISO_DATE_LENGTH = 10;
const ISO_DATETIME_LOCAL_LENGTH = 16;
const NEXT_MONDAY_OFFSET_BASE = DAYS_PER_WEEK + 1;

/**
 * Compute the scheduler-aligned default start date. Manual periods are not
 * restricted to Mondays; this only keeps the untouched create dialog aligned
 * with the automatic weekly cadence.
 * @param from - The from argument.
 */
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
  return monday.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * Render a UTC Date as the `YYYY-MM-DD` value that
 * `<input type="date">` expects. Used both by the next-Monday default
 * and by the edit-mode prefill of an existing row's envelope. The slice
 * matches the existing create-path `${periodStart}T00:00:00.000Z` round-trip
 * so a no-op edit round-trips without spurious diff.
 * @param d - The d argument.
 */
export function dateInputValue(d: Date): string {
  return d.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * Render a UTC Date as the `YYYY-MM-DDTHH:MM` value that
 * `<input type="datetime-local">` expects. The field is UTC wall-clock on
 * both read and write: this slice produces the UTC wall-clock string, and
 * handleSubmit parses it back with an explicit `:00.000Z` suffix. Treating
 * the value as UTC on both sides keeps the round-trip stable in every
 * timezone — a bare `new Date(value)` parse would read it as local time and
 * drift the stored deadline for any non-UTC admin.
 * @param d - The d argument.
 */
export function dateTimeInputValue(d: Date): string {
  return d.toISOString().slice(0, ISO_DATETIME_LOCAL_LENGTH);
}

/**
 * Deadline range validation: must fall within [periodStart, periodEnd] when
 * both are set. Parses the datetime-local value as UTC wall-clock to match
 * the submit parse and the UTC-parsed start/end bounds.
 * @param args - The args argument.
 */
export function computeDeadlineError(args: {
  readonly deadline: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}): string | null {
  const { deadline, periodStart, periodEnd } = args;
  if (!deadline) return null;
  const dl = new Date(`${deadline}:00.000Z`);
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

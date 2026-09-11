const ISO_INSTANT =
  /^(?<date>\d{4}-\d{2}-\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.\d+)?(?:Z|[+-](?<offsetHour>\d{2}):(?<offsetMinute>\d{2}))$/u;
const MAX_HOUR = 23;
const MAX_MINUTE_OR_SECOND = 59;

function isIsoInstant(value: string): boolean {
  const groups = ISO_INSTANT.exec(value)?.groups;
  if (groups === undefined) return false;
  const date = groups.date;
  if (date === undefined) return false;
  const calendarDate = new Date(`${date}T00:00:00Z`);
  const calendarDateMatches =
    !Number.isNaN(calendarDate.getTime()) &&
    calendarDate.toISOString().startsWith(`${date}T`);
  const hour = Number(groups.hour);
  const minute = Number(groups.minute);
  const second = Number(groups.second);
  const offsetHour = Number(groups.offsetHour ?? 0);
  const offsetMinute = Number(groups.offsetMinute ?? 0);
  return (
    calendarDateMatches &&
    hour <= MAX_HOUR &&
    minute <= MAX_MINUTE_OR_SECOND &&
    second <= MAX_MINUTE_OR_SECOND &&
    offsetHour <= MAX_HOUR &&
    offsetMinute <= MAX_MINUTE_OR_SECOND &&
    !Number.isNaN(new Date(value).getTime())
  );
}

// One explicit instant pins the whole seed identity graph. The current instant
// remains a convenience for casual local seeding; reproducible runs set it.
export function seedReferenceDate(): Date {
  const raw = process.env.SEED_REFERENCE_DATE;
  if (raw === undefined) {
    return new Date();
  }
  if (!isIsoInstant(raw)) {
    throw new TypeError(
      `SEED_REFERENCE_DATE must be an ISO 8601 instant, got: ${raw}`,
    );
  }
  return new Date(raw);
}

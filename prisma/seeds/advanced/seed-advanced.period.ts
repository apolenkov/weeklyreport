import { SEED_REPORTS } from "../support/seed-constants.js";

// Anchors for deterministic sample timestamps. Callers choose offsets for
// submissions and follow-up dates relative to the seeded period start.
export const ACTIVE_PERIOD_START = new Date(SEED_REPORTS.active.periodStart);
const PUBLISHED_PERIOD_START = new Date(SEED_REPORTS.published.periodStart);

const DEFAULT_OFFSET_HOUR_UTC = 10;

// Default timezone for the demo organization and its reminder policies.
export const MOSCOW_TIMEZONE = "Europe/Moscow";

// Submission fixtures span five weekdays with deterministic UTC times per lead.
export const SUBMIT_DAY_SPAN = 5;
export const FIRST_SUBMIT_HOUR_UTC = 10;

/** A whole-minute timestamp `days` after `anchor`, in UTC. */
export function periodOffset(
  anchor: Date,
  days: number,
  hours: number,
  minutes = 0,
): Date {
  const d = new Date(anchor);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

export function activeOffset(
  days: number,
  hours = DEFAULT_OFFSET_HOUR_UTC,
  minutes = 0,
): Date {
  return periodOffset(ACTIVE_PERIOD_START, days, hours, minutes);
}

export function publishedOffset(
  days: number,
  hours = DEFAULT_OFFSET_HOUR_UTC,
  minutes = 0,
): Date {
  return periodOffset(PUBLISHED_PERIOD_START, days, hours, minutes);
}

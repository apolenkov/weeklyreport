import { SEED_REPORTS } from "./seed-constants.js";

// Anchors for date-relative sample timestamps. Both period starts are computed
// once in seed-constants; mirroring that derivation here keeps submittedAt /
// decision.deadline / risk.openedAt inside the period the user actually sees.
export const ACTIVE_PERIOD_START = new Date(SEED_REPORTS.active.periodStart);
const PUBLISHED_PERIOD_START = new Date(SEED_REPORTS.published.periodStart);

const DEFAULT_OFFSET_HOUR_UTC = 10;

// The department the demo data models works Moscow time.
export const MOSCOW_TIMEZONE = "Europe/Moscow";

// Sections are submitted Mon-Fri of their period, one hour later per lead, so a
// reseed reproduces the same spread without a clock read.
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

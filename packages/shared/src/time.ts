/**
 * Calendar/clock unit constants (ratchet §2, no-magic-numbers).
 *
 * The single home for unit-conversion factors so date math across the repo
 * reads as vocabulary (`MS_PER_DAY`) instead of arithmetic trivia
 * (`24 * 60 * 60 * 1000`). Domain-specific numbers (deadline hours, retention
 * windows, poll intervals) do NOT belong here — name those next to the logic
 * that owns them.
 */

export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;

export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
export const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
export const MS_PER_DAY = MS_PER_HOUR * HOURS_PER_DAY;
export const MS_PER_WEEK = MS_PER_DAY * DAYS_PER_WEEK;

export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;

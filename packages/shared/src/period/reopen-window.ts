import { MS_PER_HOUR } from "../time";

/** Max length of a lead's reopen-request reason. */
export const MAX_REOPEN_REASON_LENGTH = 500;

/**
 * Is a published period still inside its reopen window at `now`? `0` hours
 * means "no window bound" (the setting only caps how long after publish a
 * reopen stays possible), and the closing instant itself is still eligible.
 */
export function isWithinReopenWindow(
  reopenWindowHours: number,
  publishedAt: Date,
  now: number,
): boolean {
  return (
    reopenWindowHours === 0 ||
    now <= publishedAt.getTime() + reopenWindowHours * MS_PER_HOUR
  );
}

import { MS_PER_HOUR } from "../time";

/**
 * Is a published period still inside its reopen window at `now`? `0` hours
 * means "no window bound" (the setting only caps how long after publish a
 * reopen stays possible), and the closing instant itself is still eligible.
 * @param reopenWindowHours - `AppSettings.reopenWindowHours`; `0` = unbounded.
 * @param publishedAt - The instant the window is measured from.
 * @param now - Epoch milliseconds to evaluate the window at.
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

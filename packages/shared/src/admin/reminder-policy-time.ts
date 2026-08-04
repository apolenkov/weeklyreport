import { DateTime } from "luxon";

/** Active interval in which a reminder policy applies to period deadlines. */
export interface ReminderPolicyValidity {
  readonly active: boolean;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
}

/**
 * Apply an elapsed-minute offset to a deadline and return the resulting UTC
 * instant. Crossing a DST boundary preserves elapsed time, not wall time.
 */
export function computeReminderFireAt(
  deadline: Date,
  offsetMinutes: number,
  timezone: string,
): Date {
  return DateTime.fromJSDate(deadline, { zone: "utc" })
    .setZone(timezone)
    .plus({ minutes: offsetMinutes })
    .toUTC()
    .toJSDate();
}

/**
 * Whether a period deadline falls inside an active policy's inclusive validity window.
 */
export function reminderPolicyAppliesTo(
  policy: ReminderPolicyValidity,
  deadline: Date,
): boolean {
  if (!policy.active) return false;
  if (deadline.getTime() < policy.validFrom.getTime()) return false;
  return (
    policy.validUntil === null ||
    deadline.getTime() <= policy.validUntil.getTime()
  );
}

import { DateTime } from "luxon";

export interface ReminderPolicyValidity {
  readonly active: boolean;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
}

/**
 * Apply an elapsed-minute offset to a deadline and return the resulting UTC
 * instant. Crossing a DST boundary preserves elapsed time, not wall time.
 * @param deadline - Absolute deadline used as the offset origin.
 * @param offsetMinutes - Signed elapsed-minute offset.
 * @param timezone - IANA zone used while applying the offset.
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
 * Whether a period deadline falls inside an active policy's validity window.
 * @param policy - Activation flag and inclusive validity bounds.
 * @param deadline - Period deadline to test.
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

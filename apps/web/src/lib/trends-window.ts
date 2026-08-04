import { toIsoDateString } from "./format-date";

// Anchor the rolling UTC window to now and clamp month length so Feb 29 does
// not overflow into March and drop the oldest report.
export function deriveTrendsWindow(now: Date): {
  periodFrom: string;
  periodTo: string;
} {
  const fromYear = now.getUTCFullYear() - 1;
  const month = now.getUTCMonth();
  // Day 0 of the NEXT month = last day of the target month.
  const lastDayOfTargetMonth = new Date(
    Date.UTC(fromYear, month + 1, 0),
  ).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDayOfTargetMonth);
  const from = new Date(Date.UTC(fromYear, month, day));
  return { periodFrom: toIsoDateString(from), periodTo: toIsoDateString(now) };
}

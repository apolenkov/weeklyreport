import { MS_PER_HOUR } from "@customreport/shared";

export function evaluateSubmissionDeadline(
  deadline: Date,
  settings: { gracePeriodHours: number; allowLateSubmissions: boolean },
  now: number,
): "on-time" | "late" | "closed" {
  const deadlineMs = deadline.getTime();
  if (now <= deadlineMs) return "on-time";
  return now > deadlineMs + settings.gracePeriodHours * MS_PER_HOUR &&
    !settings.allowLateSubmissions
    ? "closed"
    : "late";
}

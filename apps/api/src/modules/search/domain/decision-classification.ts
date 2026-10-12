import type { DecisionState, DecisionTiming } from "@weeklyreport/shared";
import { DateTime } from "luxon";

import type { DecisionCandidate } from "./report-retrieval.types.js";

export type DecisionClassification = Readonly<{
  state: DecisionState;
  timing: DecisionTiming;
}>;

const localCalendarDate = (value: Date, timeZone: string): string => {
  const date = DateTime.fromJSDate(value, { zone: timeZone }).toISODate();
  if (!date) throw new Error("Unable to classify a decision date.");
  return date;
};

export function classifyDecision(
  candidate: DecisionCandidate,
  now: Date,
  timeZone: string,
): DecisionClassification {
  const state: DecisionState =
    candidate.resolvedAt === null ? "open" : "resolved";
  if (candidate.deadline === null) {
    return { state, timing: "without_deadline" };
  }

  const deadline = localCalendarDate(candidate.deadline, timeZone);
  if (candidate.resolvedAt !== null) {
    const resolved = localCalendarDate(candidate.resolvedAt, timeZone);
    return {
      state,
      timing: resolved <= deadline ? "resolved_on_time" : "resolved_late",
    };
  }

  const today = localCalendarDate(now, timeZone);
  return {
    state,
    timing:
      deadline < today
        ? "overdue"
        : deadline === today
          ? "due_today"
          : "upcoming",
  };
}

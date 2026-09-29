import { describe, expect, it } from "vitest";

import { evaluateSubmissionDeadline } from "./submission-deadline.js";

const DEADLINE = new Date("2026-09-30T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;

describe("submission deadline policy", () => {
  it.each([
    {
      hoursPast: -1,
      gracePeriodHours: 0,
      allowLateSubmissions: false,
      result: "on-time",
    },
    {
      hoursPast: 0,
      gracePeriodHours: 0,
      allowLateSubmissions: false,
      result: "on-time",
    },
    {
      hoursPast: 1,
      gracePeriodHours: 24,
      allowLateSubmissions: false,
      result: "late",
    },
    {
      hoursPast: 24,
      gracePeriodHours: 24,
      allowLateSubmissions: false,
      result: "late",
    },
    {
      hoursPast: 25,
      gracePeriodHours: 24,
      allowLateSubmissions: false,
      result: "closed",
    },
    {
      hoursPast: 25,
      gracePeriodHours: 24,
      allowLateSubmissions: true,
      result: "late",
    },
  ] as const)(
    "$hoursPast hours after deadline with grace=$gracePeriodHours and allowLate=$allowLateSubmissions: $result",
    ({ hoursPast, gracePeriodHours, allowLateSubmissions, result }) => {
      expect(
        evaluateSubmissionDeadline(
          DEADLINE,
          { gracePeriodHours, allowLateSubmissions },
          DEADLINE.getTime() + hoursPast * HOUR,
        ),
      ).toBe(result);
    },
  );
});

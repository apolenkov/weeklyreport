import { describe, expect, it } from "vitest";

import {
  AdminDeadlineTimeFormatError,
  computePeriodPatch,
  deadlineHourFromSetting,
  type PeriodEnvelope,
} from "./period-admin.envelope.js";

const existing: PeriodEnvelope = {
  periodStart: new Date("2026-05-04T00:00:00.000Z"),
  periodEnd: new Date("2026-05-10T23:59:59.999Z"),
  deadline: new Date("2026-05-09T15:00:00.000Z"),
  weekLabel: "Sprint 11",
};

describe("computePeriodPatch", () => {
  it("returns an empty patch for a no-op input", () => {
    expect(computePeriodPatch(existing, {})).toEqual({ data: {}, diff: {} });
  });

  it("carries from/to for a changed field", () => {
    const to = new Date("2026-05-12T23:59:59.999Z");
    const { data, diff } = computePeriodPatch(existing, { periodEnd: to });

    expect(data).toEqual({ periodEnd: to });
    expect(diff).toEqual({
      periodEnd: { from: existing.periodEnd, to },
    });
  });

  it("drops an equal-value write (same instant, different Date object)", () => {
    const sameInstant = new Date(existing.deadline.toISOString());
    expect(computePeriodPatch(existing, { deadline: sameInstant })).toEqual({
      data: {},
      diff: {},
    });
  });

  it("treats a weekLabel null-clear as a change", () => {
    const { data, diff } = computePeriodPatch(existing, { weekLabel: null });

    expect(data).toEqual({ weekLabel: null });
    expect(diff).toEqual({
      weekLabel: { from: "Sprint 11", to: null },
    });
  });

  it("distinguishes an omitted weekLabel from an unchanged one", () => {
    expect(computePeriodPatch(existing, {})).toEqual({ data: {}, diff: {} });
    expect(computePeriodPatch(existing, { weekLabel: "Sprint 11" })).toEqual({
      data: {},
      diff: {},
    });
  });
});

describe("deadlineHourFromSetting", () => {
  it("parses the hour from a valid HH:mm setting", () => {
    expect(deadlineHourFromSetting("18:30")).toBe(18);
  });

  it.each(["", "9:00", "24:00", "18:60", "invalid"])(
    "rejects malformed deadlineTime %j",
    (deadlineTime) => {
      expect(() => deadlineHourFromSetting(deadlineTime)).toThrow(
        new AdminDeadlineTimeFormatError(deadlineTime),
      );
    },
  );
});

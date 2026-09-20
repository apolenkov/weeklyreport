import { describe, expect, it } from "vitest";

import type { AdminReminderPolicyView, AdminReminderView } from "./admin-types";
import {
  describeRecipient,
  formatPolicyTiming,
  formatValidityWindow,
  getOffsetAmount,
  getOffsetUnit,
  nextSendDate,
  OFFSET_UNITS,
  offsetUnitFactor,
  presetForPolicy,
  presetPairing,
  type ReminderPreset,
} from "./reminders-tab-format";

const POLICY: AdminReminderPolicyView = {
  id: "policy-1",
  kind: "deadline",
  offsetMinutes: 0,
  timezone: "UTC",
  audience: "lead-with-draft",
  active: true,
  validFrom: new Date("2026-09-20T00:00:00.000Z"),
  validUntil: null,
};

function policy(
  overrides: Partial<AdminReminderPolicyView> = {},
): AdminReminderPolicyView {
  return { ...POLICY, ...overrides };
}

describe("OFFSET_UNITS", () => {
  it("is the exact offset-unit vocabulary", () => {
    expect(OFFSET_UNITS).toEqual(["minutes", "hours", "days"]);
  });
});

describe("reminder presets", () => {
  it("maps both supported policy pairings to presets and back", () => {
    expect(presetForPolicy("deadline", "lead-with-draft")).toBe(
      "deadline-leads",
    );
    expect(presetForPolicy("escalation", "head-of-late")).toBe(
      "escalation-head",
    );
    expect(presetPairing("deadline-leads")).toEqual({
      kind: "deadline",
      audience: "lead-with-draft",
    });
    expect(presetPairing("escalation-head")).toEqual({
      kind: "escalation",
      audience: "head-of-late",
    });
  });

  it("rejects unsupported policy pairings and unknown presets", () => {
    expect(() => presetForPolicy("deadline", "head-of-late")).toThrow(
      "Unsupported reminder policy: deadline/head-of-late",
    );
    expect(() => presetForPolicy("escalation", "lead-with-draft")).toThrow(
      "Unsupported reminder policy: escalation/lead-with-draft",
    );
    expect(() =>
      presetForPolicy(
        "other" as Parameters<typeof presetForPolicy>[0],
        "lead-with-draft",
      ),
    ).toThrow("Unsupported reminder policy: other/lead-with-draft");
    expect(() => presetPairing("unknown" as ReminderPreset)).toThrow(
      "Unknown reminder preset: unknown",
    );
  });
});

describe("recipient and offset formatting", () => {
  it("describes both supported audiences", () => {
    expect(describeRecipient("lead-with-draft")).toBe(
      "Notifies leads who still owe a report",
    );
    expect(describeRecipient("head-of-late")).toBe(
      "Sends the department head a digest of late leads",
    );
  });

  it("returns the minute factor for every offset unit", () => {
    expect(offsetUnitFactor("minutes")).toBe(1);
    expect(offsetUnitFactor("hours")).toBe(60);
    expect(offsetUnitFactor("days")).toBe(1440);
  });

  it.each([
    [0, "minutes"],
    [1, "minutes"],
    [60, "hours"],
    [2880, "hours"],
    [3000, "hours"],
    [4320, "days"],
  ] as const)("chooses %s for %s minutes", (minutes, expected) => {
    expect(getOffsetUnit(minutes)).toBe(expected);
  });

  it("returns a positive magnitude in the requested unit", () => {
    expect(getOffsetAmount(-90, "minutes")).toBe(90);
    expect(getOffsetAmount(-120, "hours")).toBe(2);
    expect(getOffsetAmount(-2880, "days")).toBe(2);
  });
});

describe("formatPolicyTiming", () => {
  it.each([
    [0, "At deadline"],
    [-60, "1 hour before deadline"],
    [120, "2 hours after deadline"],
    [4320, "3 days after deadline"],
    [-1, "1 minute before deadline"],
  ])("formats %s offset minutes as %s", (offsetMinutes, expected) => {
    expect(formatPolicyTiming(policy({ offsetMinutes }))).toBe(expected);
  });
});

describe("formatValidityWindow", () => {
  it("formats an open-ended window", () => {
    expect(formatValidityWindow(policy())).toBe(
      "Valid since 2026-09-20 · no end date",
    );
  });

  it("formats a bounded window", () => {
    expect(
      formatValidityWindow(
        policy({ validUntil: new Date("2026-09-30T00:00:00.000Z") }),
      ),
    ).toBe("2026-09-20 → 2026-09-30");
  });

  it.each([
    ["validFrom", policy({ validFrom: new Date(Number.NaN) })],
    ["validUntil", policy({ validUntil: new Date(Number.NaN) })],
  ] as const)("throws for an invalid %s date", (_field, invalidPolicy) => {
    expect(() => formatValidityWindow(invalidPolicy)).toThrow(RangeError);
  });
});

describe("nextSendDate", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");

  it("returns null when there is no active future rule", () => {
    const rules: AdminReminderView[] = [
      {
        policyId: "past",
        active: true,
        fireAt: new Date("2026-09-20T11:00:00Z"),
      },
      {
        policyId: "inactive",
        active: false,
        fireAt: new Date("2026-09-21T11:00:00Z"),
      },
    ];
    expect(nextSendDate(rules, now)).toBeNull();
  });

  it("returns the earliest active future rule regardless of input order", () => {
    const rules: AdminReminderView[] = [
      {
        policyId: "late",
        active: true,
        fireAt: new Date("2026-09-22T11:00:00Z"),
      },
      {
        policyId: "early",
        active: true,
        fireAt: new Date("2026-09-21T11:00:00Z"),
      },
      {
        policyId: "past",
        active: true,
        fireAt: new Date("2026-09-20T11:00:00Z"),
      },
    ];
    expect(nextSendDate(rules, now)).toBe("Sep 21, 2026");
  });
});

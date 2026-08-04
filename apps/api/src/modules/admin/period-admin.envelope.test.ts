import { MS_PER_HOUR, type PeriodState } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import type { PeriodRowFromRepo } from "./admin-shared.js";
import {
  AdminDeadlineTimeFormatError,
  computePeriodPatch,
  deadlineTimeFromSetting,
  type PeriodEnvelope,
  toPeriodListItem,
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
    const sameInstant = new Date(expectDefined(existing.deadline));
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

  it("treats a deadline null-clear as a change carrying `to: null`", () => {
    const { data, diff } = computePeriodPatch(existing, { deadline: null });
    expect(data).toEqual({ deadline: null });
    expect(diff).toEqual({
      deadline: { from: existing.deadline, to: null },
    });
  });

  it("setting a deadline on a deadline-less period carries `from: null`", () => {
    const cleared = { ...existing, deadline: null };
    const to = new Date("2026-05-09T15:00:00.000Z");
    const { data, diff } = computePeriodPatch(cleared, { deadline: to });
    expect(data).toEqual({ deadline: to });
    expect(diff).toEqual({ deadline: { from: null, to } });
  });

  it("drops a null-clear of an already deadline-less period as a no-op", () => {
    const cleared = { ...existing, deadline: null };
    expect(computePeriodPatch(cleared, { deadline: null })).toEqual({
      data: {},
      diff: {},
    });
  });

  it("distinguishes an omitted deadline from an explicit clear", () => {
    expect(computePeriodPatch(existing, {})).toEqual({ data: {}, diff: {} });
    expect(
      computePeriodPatch(existing, { deadline: null }).data,
    ).toHaveProperty("deadline", null);
  });

  it("distinguishes an omitted weekLabel from an unchanged one", () => {
    expect(computePeriodPatch(existing, {})).toEqual({ data: {}, diff: {} });
    expect(computePeriodPatch(existing, { weekLabel: "Sprint 11" })).toEqual({
      data: {},
      diff: {},
    });
  });
});

const PUBLISHED_AT = new Date("2026-05-11T09:00:00.000Z");
const WINDOW_HOURS = 72;
const WINDOW_END = PUBLISHED_AT.getTime() + WINDOW_HOURS * MS_PER_HOUR;

const periodRow = (
  overrides: Partial<PeriodRowFromRepo> = {},
): PeriodRowFromRepo => ({
  id: "11111111-1111-4111-8111-111111111111",
  periodStart: existing.periodStart,
  periodEnd: existing.periodEnd,
  deadline: existing.deadline,
  publishedAt: PUBLISHED_AT,
  periodState: "published",
  periodStatus: "published",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  submittedCount: 3,
  totalCount: 6,
  weekLabel: existing.weekLabel,
  ...overrides,
});

const canReopenAt = (
  now: number,
  reopenWindowHours = WINDOW_HOURS,
  row: Partial<PeriodRowFromRepo> = {},
  allowReopenAfterPublish = true,
): boolean =>
  toPeriodListItem(
    periodRow(row),
    { allowReopenAfterPublish, reopenWindowHours },
    now,
  ).canReopen;

describe("toPeriodListItem — canReopen", () => {
  it("is true inside the window", () => {
    expect(canReopenAt(PUBLISHED_AT.getTime() + 2 * MS_PER_HOUR)).toBe(true);
  });

  it("is true at the last instant of the window", () => {
    expect(canReopenAt(WINDOW_END - 1)).toBe(true);
  });

  // The two cases below mirror the reopen gate in `period.service.ts`, which
  // is the authority: it rejects only once `now` is PAST `windowEnd`, and it
  // skips the window check entirely when `reopenWindowHours` is 0.
  it("is true at the exact window boundary", () => {
    expect(canReopenAt(WINDOW_END)).toBe(true);
  });

  it("is false one millisecond past the window", () => {
    expect(canReopenAt(WINDOW_END + 1)).toBe(false);
  });

  it("treats a zero window as unbounded", () => {
    expect(canReopenAt(PUBLISHED_AT.getTime() + 10_000 * MS_PER_HOUR, 0)).toBe(
      true,
    );
  });

  it("is false when the reopen policy is off", () => {
    expect(
      canReopenAt(
        PUBLISHED_AT.getTime() + MS_PER_HOUR,
        WINDOW_HOURS,
        {},
        false,
      ),
    ).toBe(false);
  });

  it("is false without a publishedAt to measure the window from", () => {
    expect(
      canReopenAt(PUBLISHED_AT.getTime() + MS_PER_HOUR, WINDOW_HOURS, {
        publishedAt: null,
      }),
    ).toBe(false);
  });

  it.each<PeriodState>(["scheduled", "open", "archived"])(
    "is false for a %s period",
    (periodState) => {
      expect(
        canReopenAt(PUBLISHED_AT.getTime() + MS_PER_HOUR, WINDOW_HOURS, {
          periodState,
        }),
      ).toBe(false);
    },
  );
});

describe("deadlineTimeFromSetting", () => {
  it("preserves hour and minute from a valid HH:mm setting", () => {
    expect(deadlineTimeFromSetting("18:30")).toEqual({
      hour: 18,
      minute: 30,
    });
  });

  it.each(["", "9:00", "24:00", "18:60", "invalid"])(
    "rejects malformed deadlineTime %j",
    (deadlineTime) => {
      expect(() => deadlineTimeFromSetting(deadlineTime)).toThrow(
        new AdminDeadlineTimeFormatError(deadlineTime),
      );
    },
  );
});

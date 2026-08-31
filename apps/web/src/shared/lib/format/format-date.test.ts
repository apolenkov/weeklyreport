import {
  DAYS_PER_WEEK,
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  formatRelativePast,
  type RelativePastVariant,
  toIsoDateString,
} from "./format-date";

const NOW = new Date("2026-04-20T12:00:00.000Z");

const ago = (seconds: number): Date =>
  new Date(NOW.getTime() - seconds * MS_PER_SECOND);

describe("formatRelativePast", () => {
  it.each<{
    variant: RelativePastVariant;
    seconds: number;
    expected: string;
  }>([
    { variant: "compact", seconds: 59, expected: "just now" },
    { variant: "compact", seconds: 60, expected: "1 min ago" },
    { variant: "compact", seconds: 60 * 60, expected: "1h ago" },
    { variant: "compact", seconds: 5 * 60 * 60, expected: "5h ago" },
    { variant: "compact", seconds: 24 * 60 * 60, expected: "Apr 19" },
    { variant: "long", seconds: 59, expected: "just now" },
    { variant: "long", seconds: 60, expected: "1 min ago" },
    { variant: "long", seconds: 60 * 60, expected: "1 hour ago" },
    { variant: "long", seconds: 5 * 60 * 60, expected: "5 hours ago" },
    { variant: "long", seconds: 24 * 60 * 60, expected: "Apr 19" },
    { variant: "activity", seconds: 29, expected: "just now" },
    { variant: "activity", seconds: 30, expected: "30s ago" },
    { variant: "activity", seconds: 60, expected: "1 min ago" },
    { variant: "activity", seconds: 60 * 60, expected: "1h ago" },
    { variant: "activity", seconds: 24 * 60 * 60, expected: "1d ago" },
  ])(
    "formats $variant at $seconds seconds",
    ({ variant, seconds, expected }) => {
      expect(formatRelativePast(ago(seconds), NOW, variant)).toBe(expected);
    },
  );

  it("uses the activity date fallback after a week", () => {
    const date = ago(
      DAYS_PER_WEEK * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE,
    );
    expect(formatRelativePast(date, NOW, "activity")).toBe("4/13/2026");
  });

  it("uses UTC for the activity date fallback", () => {
    const date = new Date("2026-04-12T23:30:00.000Z");
    const now = new Date("2026-04-20T12:00:00.000Z");

    expect(formatRelativePast(date, now, "activity")).toBe("4/12/2026");
  });

  it("clamps future timestamps to just now", () => {
    expect(
      formatRelativePast(new Date(NOW.getTime() + MS_PER_SECOND), NOW),
    ).toBe("just now");
  });
});

describe("toIsoDateString", () => {
  it("returns the ISO date-only prefix", () => {
    expect(toIsoDateString(new Date("2026-04-20T12:00:00.000Z"))).toBe(
      "2026-04-20",
    );
  });

  // The day is read in UTC, so a UTC+N runner must not roll it forward.
  it("anchors the day to UTC, not the runner's timezone", () => {
    expect(toIsoDateString(new Date("2026-07-05T23:30:00.000Z"))).toBe(
      "2026-07-05",
    );
    expect(toIsoDateString(new Date("2026-07-06T00:30:00.000Z"))).toBe(
      "2026-07-06",
    );
  });
});

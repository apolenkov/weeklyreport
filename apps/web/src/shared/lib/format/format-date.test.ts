import {
  DAYS_PER_WEEK,
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  formatDateTime,
  formatDateWithYear,
  formatPeriodLabel,
  formatPeriodRange,
  formatRelativePast,
  formatTimestampShort,
  formatWeekLabel,
  joinPeriodLabel,
  type RelativePastVariant,
  toIsoDateString,
} from "./format-date";

const NOW = new Date("2026-04-20T12:00:00.000Z");

const ago = (seconds: number): Date =>
  new Date(NOW.getTime() - seconds * MS_PER_SECOND);

describe("formatDateTime", () => {
  it("uses the English locale's medium date and short time format", () => {
    const date = new Date("2026-04-20T12:30:00.000Z");
    const expected = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);

    expect(formatDateTime(date)).toBe(expected);
    expect(formatDateTime(date)).toMatch(/Apr 20, 2026/);
  });

  it.each([null, undefined] as const)(
    "renders a missing timestamp as an em dash (%s)",
    (date) => {
      expect(formatDateTime(date)).toBe("—");
    },
  );

  it("preserves an invalid Date as the platform's invalid-date label", () => {
    expect(formatDateTime(new Date("invalid"))).toBe("Invalid Date");
  });
});

describe("formatTimestampShort and formatDateWithYear", () => {
  const date = new Date("2026-07-05T23:30:00.000Z");

  it("uses UTC calendar parts for a date-only label", () => {
    expect(formatTimestampShort(date)).toBe("Jul 5");
  });

  it("adds the UTC year without shifting the day", () => {
    expect(formatDateWithYear(date)).toBe("Jul 5, 2026");
  });
});

describe("formatWeekLabel", () => {
  it("keeps an ISO boundary date in week 1", () => {
    expect(formatWeekLabel("2025-12-29T00:00:00.000Z")).toBe("Week 1");
  });
});

describe("formatPeriodRange", () => {
  it.each([
    [null, new Date("2026-04-20T00:00:00.000Z")],
    [new Date("2026-04-20T00:00:00.000Z"), undefined],
  ] as const)("renders an incomplete range as an em dash", (start, end) => {
    expect(formatPeriodRange(start, end)).toBe("—");
  });

  it("formats same-month and cross-month ranges from UTC dates", () => {
    expect(
      formatPeriodRange(
        new Date("2026-04-14T23:30:00.000Z"),
        new Date("2026-04-20T00:30:00.000Z"),
      ),
    ).toBe("Apr 14–20");
    expect(
      formatPeriodRange(
        new Date("2026-04-30T23:30:00.000Z"),
        new Date("2026-05-01T00:30:00.000Z"),
      ),
    ).toBe("Apr 30–May 1");
  });
});

describe("formatPeriodLabel", () => {
  it("combines the ISO week and UTC range", () => {
    expect(
      formatPeriodLabel(
        new Date("2026-04-14T00:00:00.000Z"),
        new Date("2026-04-20T00:00:00.000Z"),
      ),
    ).toBe("Week 16, Apr 14–20, 2026");
  });

  it("renders an incomplete period as unavailable", () => {
    expect(formatPeriodLabel(null, new Date("2026-04-20T00:00:00.000Z"))).toBe(
      "Period unavailable",
    );
  });
});

describe("joinPeriodLabel", () => {
  it("trims and joins both labels", () => {
    expect(joinPeriodLabel(" Week 16 ", " Apr 14–20, 2026 ")).toBe(
      "Week 16, Apr 14–20, 2026",
    );
  });

  it.each([
    ["Week 16", null, "Week 16"],
    [undefined, "Apr 14–20, 2026", "Apr 14–20, 2026"],
    ["  ", "\t", "Period unavailable"],
  ] as const)("handles a missing side (%s, %s)", (week, range, expected) => {
    expect(joinPeriodLabel(week, range)).toBe(expected);
  });
});

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

import { describe, expect, it } from "vitest";

import { groupReportsByLabel, isoDateOnly } from "./analytics-period-math.js";

// Analytics period labels must remain UTC-stable across process time zones.

// Europe/Moscow (UTC+3) is already 2026-04-29 for this instant.
const NEAR_MIDNIGHT_UTC = new Date("2026-04-28T23:30:00.000Z");
const EXPECTED_UTC_LABEL = "2026-04-28";

function underTZ<T>(tz: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previous;
    }
  }
}

describe("Analytics labels are TZ-stable", () => {
  it("isoDateOnly matches under Europe/Moscow and UTC for near-midnight samples", () => {
    // Samples that local-time formatters would split across calendar days.
    const samples = [
      NEAR_MIDNIGHT_UTC,
      new Date("2026-04-28T00:30:00.000Z"),
      new Date("2026-10-25T21:00:00.000Z"),
    ];
    const expected = ["2026-04-28", "2026-04-28", "2026-10-25"];

    const moscow = underTZ("Europe/Moscow", () => samples.map(isoDateOnly));
    const utc = underTZ("UTC", () => samples.map(isoDateOnly));

    expect(moscow).toEqual(utc);
    expect(moscow).toEqual(expected);
  });

  it("groupReportsByLabel keys match under Europe/Moscow and UTC", () => {
    const reports = [{ periodEnd: NEAR_MIDNIGHT_UTC }];

    const moscowKeys = underTZ("Europe/Moscow", () => [
      ...groupReportsByLabel(reports).keys(),
    ]);
    const utcKeys = underTZ("UTC", () => [
      ...groupReportsByLabel(reports).keys(),
    ]);

    expect(moscowKeys).toEqual(utcKeys);
    expect(moscowKeys).toEqual([EXPECTED_UTC_LABEL]);
  });

  it("Date.toISOString().slice(0,10) is itself TZ-stable", () => {
    // Sanity check on the Node primitive isoDateOnly wraps. If this fails,
    // runtime semantics changed — escalate.
    const moscowLabel = underTZ("Europe/Moscow", () =>
      NEAR_MIDNIGHT_UTC.toISOString().slice(0, 10),
    );
    const utcLabel = underTZ("UTC", () =>
      NEAR_MIDNIGHT_UTC.toISOString().slice(0, 10),
    );

    expect(moscowLabel).toBe(utcLabel);
    expect(moscowLabel).toBe(EXPECTED_UTC_LABEL);
  });
});

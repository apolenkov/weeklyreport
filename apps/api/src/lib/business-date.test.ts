import { DateTime } from "luxon";
import { describe, expect, it, vi } from "vitest";

import {
  addBusinessDays,
  computeDeadline,
  getCurrentWeekBounds,
  parseDeadlineTime,
} from "./business-date";

// Helper: build a UTC `Date` from an ISO wall-clock string interpreted in the
// given IANA zone, so assertions read in local-time intent rather than
// pre-shifted UTC strings.
function inZone(iso: string, tz: string): Date {
  const dt = DateTime.fromISO(iso, { zone: tz });
  if (!dt.isValid) {
    throw new Error(`test helper: invalid ${iso} @ ${tz}: ${dt.invalidReason}`);
  }
  return dt.toJSDate();
}

// Helper: assert a `Date` corresponds to the given wall-clock string in `tz`.
function expectWallClock(date: Date, isoNoZone: string, tz: string): void {
  const got = DateTime.fromJSDate(date)
    .setZone(tz)
    .toFormat("yyyy-MM-dd'T'HH:mm:ss");
  expect(got).toBe(isoNoZone);
}

const TZ_MSK = "Europe/Moscow";
const TZ_BER = "Europe/Berlin";
const TZ_NYC = "America/New_York";

describe("business-date: addBusinessDays — mon-fri", () => {
  it("Monday + 4 business days = Friday", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK); // Mon
    const got = addBusinessDays(start, 4, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-08T09:00:00", TZ_MSK); // Fri
  });

  it.each([
    {
      label: "Monday + 5 business days = next Monday (skipping Sat/Sun)",
      start: "2026-05-04T09:00:00",
      days: 5,
      expected: "2026-05-11T09:00:00",
    },
    {
      label: "Friday + 1 business day = next Monday",
      start: "2026-05-08T09:00:00",
      days: 1,
      expected: "2026-05-11T09:00:00",
    },
    {
      label: "Saturday + 1 business day = Monday (skips the trailing Sunday)",
      start: "2026-05-09T09:00:00",
      days: 1,
      expected: "2026-05-11T09:00:00",
    },
  ] as const)("$label", ({ start, days, expected }) => {
    const got = addBusinessDays(inZone(start, TZ_MSK), days, "mon-fri", TZ_MSK);
    expectWallClock(got, expected, TZ_MSK);
  });
});

describe("business-date: addBusinessDays — mon-sat", () => {
  it("Friday + 1 = Saturday", () => {
    const start = inZone("2026-05-08T09:00:00", TZ_MSK);
    const got = addBusinessDays(start, 1, "mon-sat", TZ_MSK);
    expectWallClock(got, "2026-05-09T09:00:00", TZ_MSK);
  });
  it("Saturday + 1 = next Monday (skips Sunday)", () => {
    const start = inZone("2026-05-09T09:00:00", TZ_MSK);
    const got = addBusinessDays(start, 1, "mon-sat", TZ_MSK);
    expectWallClock(got, "2026-05-11T09:00:00", TZ_MSK);
  });
  it("Friday + 2 = next Monday (Fri→Sat→Mon)", () => {
    const start = inZone("2026-05-08T09:00:00", TZ_MSK);
    const got = addBusinessDays(start, 2, "mon-sat", TZ_MSK);
    expectWallClock(got, "2026-05-11T09:00:00", TZ_MSK);
  });
});

describe("business-date: addBusinessDays — mon-sun", () => {
  it("Saturday + 1 = Sunday (every day counts)", () => {
    const start = inZone("2026-05-09T09:00:00", TZ_MSK);
    const got = addBusinessDays(start, 1, "mon-sun", TZ_MSK);
    expectWallClock(got, "2026-05-10T09:00:00", TZ_MSK);
  });
  it("Sunday + 1 = Monday (every day counts)", () => {
    const start = inZone("2026-05-10T09:00:00", TZ_MSK);
    const got = addBusinessDays(start, 1, "mon-sun", TZ_MSK);
    expectWallClock(got, "2026-05-11T09:00:00", TZ_MSK);
  });
  it("Monday + 7 = next Monday (pure calendar arithmetic)", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK);
    const got = addBusinessDays(start, 7, "mon-sun", TZ_MSK);
    expectWallClock(got, "2026-05-11T09:00:00", TZ_MSK);
  });
});

describe("business-date: addBusinessDays — n = 0 and negative", () => {
  it("n = 0 returns the same instant (no snap)", () => {
    const start = inZone("2026-05-09T09:00:00", TZ_MSK); // Saturday
    const got = addBusinessDays(start, 0, "mon-fri", TZ_MSK);
    expect(got.getTime()).toBe(start.getTime());
  });

  it("Monday - 1 business day = previous Friday (mon-fri)", () => {
    const start = inZone("2026-05-11T09:00:00", TZ_MSK); // Mon
    const got = addBusinessDays(start, -1, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-08T09:00:00", TZ_MSK);
  });

  it("Monday - 5 business days = previous Monday (mon-fri)", () => {
    const start = inZone("2026-05-11T09:00:00", TZ_MSK);
    const got = addBusinessDays(start, -5, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-04T09:00:00", TZ_MSK);
  });
});

describe("business-date: addBusinessDays — boundaries", () => {
  it("stops date arithmetic after finding a nearby business day", () => {
    const start = inZone("2026-05-08T09:00:00", TZ_MSK);
    const plus = vi.spyOn(DateTime.prototype, "plus");
    try {
      const result = addBusinessDays(start, 1, "mon-fri", TZ_MSK);
      expectWallClock(result, "2026-05-11T09:00:00", TZ_MSK);
      expect(plus.mock.calls.length).toBeLessThanOrEqual(7);
    } finally {
      plus.mockRestore();
    }
  });

  it.each([
    { start: "2026-03-28T02:30:00", days: 2, expected: "2026-03-30T02:30:00" },
    { start: "2026-03-30T02:30:00", days: -2, expected: "2026-03-28T02:30:00" },
  ])(
    "preserves the original clock past a DST gap for $days days",
    ({ start, days, expected }) => {
      const result = addBusinessDays(
        inZone(start, TZ_BER),
        days,
        "mon-sun",
        TZ_BER,
      );
      expectWallClock(result, expected, TZ_BER);
    },
  );

  it.each([
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("rejects a non-integer shift %s", (days) => {
    expect(() =>
      addBusinessDays(new Date("2026-05-04T09:00:00Z"), days, "mon-fri", "UTC"),
    ).toThrow("n must be a finite integer");
  });

  it("retains the maximum calendar-day walk budget", () => {
    expect(() =>
      addBusinessDays(new Date("2026-05-04T09:00:00Z"), 3661, "mon-sun", "UTC"),
    ).toThrow("exceeded iteration budget");
  });

  it("month boundary: Apr 30 (Thu) + 2 business days = May 4 (Mon) mon-fri", () => {
    // 2026-04-30 is a Thursday → +1bd = Fri May 1 → +2bd = Mon May 4.
    const start = inZone("2026-04-30T09:00:00", TZ_MSK);
    const got = addBusinessDays(start, 2, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-04T09:00:00", TZ_MSK);
  });

  it("year boundary: Dec 30 2025 (Tue) + 3 business days = Jan 2 2026 (Fri)", () => {
    const start = inZone("2025-12-30T09:00:00", TZ_MSK); // Tuesday
    const got = addBusinessDays(start, 3, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-01-02T09:00:00", TZ_MSK);
  });

  it("DST spring-forward (Europe/Berlin 2026-03-29): wall-clock hour preserved across the +1h jump", () => {
    // 2026-03-27 is Friday in CET; adding 1 business day crosses the DST start
    // overnight (02:00 → 03:00). The next mon-fri day is Mon 30 March, and the
    // assertion is that it still reads 09:00 wall-clock, not +1h drifted to 10:00.
    const start = inZone("2026-03-27T09:00:00", TZ_BER); // Fri
    const got = addBusinessDays(start, 1, "mon-fri", TZ_BER);
    expectWallClock(got, "2026-03-30T09:00:00", TZ_BER);
  });

  it("DST fall-back (America/New_York 2026-11-01): wall-clock hour preserved across the -1h jump", () => {
    // 2026-10-30 Fri → +1bd = Mon 2026-11-02. DST ends 2026-11-01 (clocks
    // fall back). Assert no -1h drift.
    const start = inZone("2026-10-30T09:00:00", TZ_NYC);
    const got = addBusinessDays(start, 1, "mon-fri", TZ_NYC);
    expectWallClock(got, "2026-11-02T09:00:00", TZ_NYC);
  });
});

describe("business-date: computeDeadline", () => {
  it("applies the explicit 18:00 wall-clock in tz", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK); // Mon 09:00
    const got = computeDeadline(start, 4, {
      workingDays: "mon-fri",
      timezone: TZ_MSK,
      deadlineTime: {
        hour: 18,
        minute: 0,
      },
    });
    expectWallClock(got, "2026-05-08T18:00:00", TZ_MSK); // Fri 18:00 MSK
  });

  it("discards the hour of periodStart (lands cleanly on HH:00:00.000)", () => {
    const start = inZone("2026-05-04T23:59:59", TZ_MSK);
    const got = computeDeadline(start, 1, {
      workingDays: "mon-fri",
      timezone: TZ_MSK,
      deadlineTime: {
        hour: 9,
        minute: 0,
      },
    });
    expectWallClock(got, "2026-05-05T09:00:00", TZ_MSK);
  });

  it("mon-sun with deadlineDays=4 from Monday lands on Friday (calendar +4)", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK);
    const got = computeDeadline(start, 4, {
      workingDays: "mon-sun",
      timezone: TZ_MSK,
      deadlineTime: {
        hour: 18,
        minute: 0,
      },
    });
    expectWallClock(got, "2026-05-08T18:00:00", TZ_MSK);
  });

  it("mon-fri vs mon-sun diverge when deadlineDays crosses a weekend", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK); // Mon
    const friMonFri = computeDeadline(start, 5, {
      workingDays: "mon-fri",
      timezone: TZ_MSK,
      deadlineTime: {
        hour: 18,
        minute: 0,
      },
    });
    const satMonSun = computeDeadline(start, 5, {
      workingDays: "mon-sun",
      timezone: TZ_MSK,
      deadlineTime: {
        hour: 18,
        minute: 0,
      },
    });
    expectWallClock(friMonFri, "2026-05-11T18:00:00", TZ_MSK); // next Mon
    expectWallClock(satMonSun, "2026-05-09T18:00:00", TZ_MSK); // Sat
  });

  it("produces UTC-stable Date (instant equality across zone observers)", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK);
    const got = computeDeadline(start, 4, {
      workingDays: "mon-fri",
      timezone: TZ_MSK,
      deadlineTime: {
        hour: 18,
        minute: 0,
      },
    });
    // Fri 2026-05-08 18:00 MSK = 15:00 UTC.
    expect(got.toISOString()).toBe("2026-05-08T15:00:00.000Z");
  });
});

describe("business-date: parseDeadlineTime", () => {
  it("parses a valid HH:MM string", () => {
    expect(parseDeadlineTime("09:30")).toEqual({ hour: 9, minute: 30 });
  });

  it("rejects a malformed string loudly instead of coercing to a default", () => {
    expect(() => parseDeadlineTime("18")).toThrow(/HH:MM/);
    expect(() => parseDeadlineTime("25:00")).toThrow(/HH:MM/);
    expect(() => parseDeadlineTime("")).toThrow(/HH:MM/);
  });
});

describe("getCurrentWeekBounds — UTC-stable week boundaries", () => {
  it("returns Monday 00:00:00 UTC and Sunday 23:59:59.999 UTC for a mid-week date", () => {
    // Wednesday 2026-04-29 12:34:56 UTC — week is Mon 2026-04-27 .. Sun 2026-05-03
    const wed = new Date("2026-04-29T12:34:56.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(wed);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });

  it("treats Monday 00:00 UTC as the start of its own week", () => {
    const mon = new Date("2026-04-27T00:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(mon);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });

  it("treats Sunday 23:59 UTC as the end of the same week (Sunday rolls back 6)", () => {
    // Sunday 2026-05-03 23:59 UTC must still belong to the Mon Apr 27 week.
    const sun = new Date("2026-05-03T23:59:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(sun);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });

  it("is stable across European DST spring-forward (last Sunday of March 2026)", () => {
    // CET → CEST spring-forward 2026-03-29: the naive setHours/setDate path
    // drifts here in a non-UTC TZ container. Pre-DST: Sat 03-28 22:00 UTC;
    // post-DST: Sun 03-29 02:00 UTC (just after spring-forward).
    const preDst = new Date("2026-03-28T22:00:00.000Z");
    const postDst = new Date("2026-03-29T02:00:00.000Z");

    // Both fall in the Mon 2026-03-23 .. Sun 2026-03-29 week.
    const a = getCurrentWeekBounds(preDst);
    const b = getCurrentWeekBounds(postDst);

    expect(a.periodStart.toISOString()).toBe("2026-03-23T00:00:00.000Z");
    expect(a.periodEnd.toISOString()).toBe("2026-03-29T23:59:59.999Z");
    expect(b.periodStart.toISOString()).toBe("2026-03-23T00:00:00.000Z");
    expect(b.periodEnd.toISOString()).toBe("2026-03-29T23:59:59.999Z");

    // The two boundaries match exactly — DST did not perturb the result.
    expect(a.periodStart.getTime()).toBe(b.periodStart.getTime());
    expect(a.periodEnd.getTime()).toBe(b.periodEnd.getTime());
  });

  it("is stable across Russia local-time edge (Moscow has no DST but TZ=Europe/Moscow shifts hour math)", () => {
    // 23:00 Moscow Sunday is 20:00 UTC Sunday — naive local-time setHours
    // would resolve "Sunday 00:00 local" differently in Moscow vs UTC.
    // 2026-04-26 20:00 UTC = 2026-04-26 23:00 Europe/Moscow.
    const moscowSundayLate = new Date("2026-04-26T20:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(moscowSundayLate);

    // Sunday 2026-04-26 UTC belongs to the Mon Apr 20 .. Sun Apr 26 week.
    expect(periodStart.toISOString()).toBe("2026-04-20T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-04-26T23:59:59.999Z");
  });

  it("produces identical bounds regardless of host TZ snapshot (canonical UTC ISO)", () => {
    // Canonical-ISO lock: expectations derive from UTC, so any reintroduction of
    // local-time math fails under a non-UTC host. Run under
    // TZ=Pacific/Kiritimati and TZ=America/Anchorage to prove zone independence.
    const fixed = new Date("2026-04-30T09:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(fixed);

    // Apr 30 2026 is a Thursday — week is Mon Apr 27 .. Sun May 3.
    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });

  it("anchors on the UTC calendar day when the host date-line disagrees", () => {
    // Sunday 2026-07-26 23:00 UTC is already Monday 13:00 in Kiritimati
    // (UTC+14) and still Sunday 14:00 in Anchorage (UTC-8). Week-start math
    // that reads the host's calendar day lands a full 7 days off under +14.
    const sundayNearMidnightUtc = new Date("2026-07-26T23:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(
      sundayNearMidnightUtc,
    );

    expect(periodStart.toISOString()).toBe("2026-07-20T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-07-26T23:59:59.999Z");
  });

  it("carries the Monday anchor back across a year boundary", () => {
    // Thursday 2026-01-01 belongs to the Mon 2025-12-29 .. Sun 2026-01-04
    // week — the anchor crosses both the month and the year.
    const newYearsDay = new Date("2026-01-01T12:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(newYearsDay);

    expect(periodStart.toISOString()).toBe("2025-12-29T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-01-04T23:59:59.999Z");
  });

  it("carries a long period forward across a year boundary", () => {
    // Monday 2025-12-29 with a 14-day period ends Sun 2026-01-11 — the
    // forward span crosses the year in the other direction.
    const lastMondayOf2025 = new Date("2025-12-29T00:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(
      lastMondayOf2025,
      14,
    );

    expect(periodStart.toISOString()).toBe("2025-12-29T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-01-11T23:59:59.999Z");
  });

  it("keeps bounds on the UTC clock across a US DST fall-back Sunday", () => {
    // 2026-11-01 is the US fall-back Sunday; 05:00 and 07:00 UTC straddle
    // the 06:00 UTC transition. Both belong to the Mon 2026-10-26 week.
    const beforeFallBack = getCurrentWeekBounds(
      new Date("2026-11-01T05:00:00.000Z"),
    );
    const afterFallBack = getCurrentWeekBounds(
      new Date("2026-11-01T07:00:00.000Z"),
    );

    expect(beforeFallBack.periodStart.toISOString()).toBe(
      "2026-10-26T00:00:00.000Z",
    );
    expect(beforeFallBack.periodEnd.toISOString()).toBe(
      "2026-11-01T23:59:59.999Z",
    );
    expect(afterFallBack.periodStart.getTime()).toBe(
      beforeFallBack.periodStart.getTime(),
    );
    expect(afterFallBack.periodEnd.getTime()).toBe(
      beforeFallBack.periodEnd.getTime(),
    );
  });

  it("rejects an invalid input Date loudly instead of propagating Invalid Date", () => {
    expect(() => getCurrentWeekBounds(new Date("not-a-date"))).toThrow(
      /business-date: input date must be valid/,
    );
  });
});

describe("getCurrentWeekBounds — periodLengthDays override", () => {
  it.each([0, -1, 1.5])(
    "rejects non-positive and non-integer length %s",
    (periodLengthDays) => {
      expect(() =>
        getCurrentWeekBounds(
          new Date("2026-04-30T09:00:00.000Z"),
          periodLengthDays,
        ),
      ).toThrow(
        `business-date: periodLengthDays must be a positive integer (got ${periodLengthDays})`,
      );
    },
  );

  it("computes periodEnd = periodStart + (length - 1) days at 23:59:59.999 UTC for length=14", () => {
    // Thursday 2026-04-30 — Monday anchor is 2026-04-27, +13 days = 2026-05-10.
    const thu = new Date("2026-04-30T09:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(thu, 14);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-10T23:59:59.999Z");
  });

  it("falls back to length=7 when no override is passed (Mon-Sun default)", () => {
    const thu = new Date("2026-04-30T09:00:00.000Z");
    const { periodEnd } = getCurrentWeekBounds(thu);

    // No override → Sunday 2026-05-03 (Monday + 6 days).
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });

  it("collapses to single-day period when length=1 (degenerate but valid)", () => {
    const thu = new Date("2026-04-30T09:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(thu, 1);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    // Monday + 0 days = same Monday, end-of-day.
    expect(periodEnd.toISOString()).toBe("2026-04-27T23:59:59.999Z");
  });
});

describe("business-date: computeDeadline DST gap and fold (TASK-503.33 C0576)", () => {
  // America/New_York 2026: spring-forward Sun 03-08 (02:00→03:00), fall-back Sun 11-01 (02:00→01:00).
  const schedule = (hour: number, minute: number) => ({
    workingDays: "mon-sun" as const,
    timezone: TZ_NYC,
    deadlineTime: { hour, minute },
  });
  // Two period starts on the same Monday, with different clock times: computeDeadline
  // "discards the hour of periodStart", so both must give the same deadline.
  const FOLD_STARTS = [
    inZone("2026-10-26T00:10:00", TZ_NYC),
    inZone("2026-10-26T09:00:00", TZ_NYC),
  ];
  const GAP_STARTS = [
    inZone("2026-03-02T00:10:00", TZ_NYC),
    inZone("2026-03-02T09:00:00", TZ_NYC),
  ];

  it("resolves an ambiguous fold time independently of periodStart's clock time", () => {
    const [early, late] = FOLD_STARTS.map((start) =>
      computeDeadline(start, 6, schedule(1, 30)),
    );

    expect(early?.toISOString()).toBe(late?.toISOString());
  });

  it("resolves an ambiguous fold time to its earlier occurrence (01:30 EDT)", () => {
    // Policy P-fold = earlier occurrence: the deadline passes the first time the clock reads it.
    for (const start of FOLD_STARTS) {
      expect(computeDeadline(start, 6, schedule(1, 30)).toISOString()).toBe(
        "2026-11-01T05:30:00.000Z",
      );
    }
  });

  it("moves a nonexistent gap time forward by the gap length (02:30 → 03:30 EDT)", () => {
    // Policy P-gap = shift forward (current Luxon behavior), pinned so it stays explicit.
    for (const start of GAP_STARTS) {
      expect(computeDeadline(start, 6, schedule(2, 30)).toISOString()).toBe(
        "2026-03-08T07:30:00.000Z",
      );
    }
  });
});

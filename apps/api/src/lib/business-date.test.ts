import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import {
  addBusinessDays,
  computeDeadline,
  isBusinessDay,
  nextBusinessDay,
  workingDaySet,
} from "./business-date";

/**
 * Helper: build a UTC `Date` from an ISO wall-clock string interpreted in
 * the given IANA zone. Keeps the tests readable — every assertion can be
 * stated in local-time intent instead of pre-shifted UTC strings.
 */
function inZone(iso: string, tz: string): Date {
  const dt = DateTime.fromISO(iso, { zone: tz });
  if (!dt.isValid) {
    throw new Error(`test helper: invalid ${iso} @ ${tz}: ${dt.invalidReason}`);
  }
  return dt.toJSDate();
}

/**
 * Helper: assert a `Date` corresponds to the given wall-clock string in `tz`.
 */
function expectWallClock(date: Date, isoNoZone: string, tz: string): void {
  const got = DateTime.fromJSDate(date)
    .setZone(tz)
    .toFormat("yyyy-MM-dd'T'HH:mm:ss");
  expect(got).toBe(isoNoZone);
}

const TZ_MSK = "Europe/Moscow";
const TZ_BER = "Europe/Berlin";
const TZ_NYC = "America/New_York";

describe("business-date: workingDaySet", () => {
  it("mon-fri returns 1..5", () => {
    expect([...workingDaySet("mon-fri")].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("mon-sat returns 1..6", () => {
    expect([...workingDaySet("mon-sat")].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("mon-sun returns 1..7", () => {
    expect([...workingDaySet("mon-sun")].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("business-date: isBusinessDay", () => {
  // 2026-05-04 is a Monday, 2026-05-09 Saturday, 2026-05-10 Sunday.
  const monday = inZone("2026-05-04T10:00:00", TZ_MSK);
  const saturday = inZone("2026-05-09T10:00:00", TZ_MSK);
  const sunday = inZone("2026-05-10T10:00:00", TZ_MSK);

  it("mon-fri: Monday is business", () => {
    expect(isBusinessDay(monday, "mon-fri", TZ_MSK)).toBe(true);
  });
  it("mon-fri: Saturday is NOT business", () => {
    expect(isBusinessDay(saturday, "mon-fri", TZ_MSK)).toBe(false);
  });
  it("mon-fri: Sunday is NOT business", () => {
    expect(isBusinessDay(sunday, "mon-fri", TZ_MSK)).toBe(false);
  });
  it("mon-sat: Saturday IS business", () => {
    expect(isBusinessDay(saturday, "mon-sat", TZ_MSK)).toBe(true);
  });
  it("mon-sat: Sunday is NOT business", () => {
    expect(isBusinessDay(sunday, "mon-sat", TZ_MSK)).toBe(false);
  });
  it("mon-sun: every day is business", () => {
    expect(isBusinessDay(sunday, "mon-sun", TZ_MSK)).toBe(true);
    expect(isBusinessDay(saturday, "mon-sun", TZ_MSK)).toBe(true);
    expect(isBusinessDay(monday, "mon-sun", TZ_MSK)).toBe(true);
  });

  it("timezone-aware: late-Sunday UTC that is already Monday in MSK reads as Monday", () => {
    // Sunday 2026-05-10 22:30 UTC = Monday 2026-05-11 01:30 MSK
    const date = new Date(Date.UTC(2026, 4, 10, 22, 30, 0));
    expect(isBusinessDay(date, "mon-fri", TZ_MSK)).toBe(true);
    expect(isBusinessDay(date, "mon-fri", "UTC")).toBe(false);
  });

  it("throws on invalid timezone", () => {
    expect(() => isBusinessDay(new Date(), "mon-fri", "Not/A_Zone")).toThrow(
      /invalid timezone/,
    );
  });
});

describe("business-date: addBusinessDays — mon-fri", () => {
  it("Monday + 4 business days = Friday", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK); // Mon
    const got = addBusinessDays(start, 4, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-08T09:00:00", TZ_MSK); // Fri
  });

  it("Monday + 5 business days = next Monday (skipping Sat/Sun)", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK);
    const got = addBusinessDays(start, 5, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-11T09:00:00", TZ_MSK);
  });

  it("Friday + 1 business day = next Monday", () => {
    const start = inZone("2026-05-08T09:00:00", TZ_MSK); // Fri
    const got = addBusinessDays(start, 1, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-11T09:00:00", TZ_MSK);
  });

  it("Saturday + 1 business day = Monday (skips the trailing Sunday)", () => {
    const start = inZone("2026-05-09T09:00:00", TZ_MSK); // Sat
    const got = addBusinessDays(start, 1, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-11T09:00:00", TZ_MSK);
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
    // 2026-03-27 is Friday in CET. Adding 1 business day crosses DST start
    // overnight Sat→Sun (clocks jump from 02:00 to 03:00). The next business
    // day in mon-fri after Fri 27 March is Mon 30 March — the assertion is
    // that we still get 09:00 wall-clock on Mon, not a +1h drift to 10:00.
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

describe("business-date: nextBusinessDay", () => {
  it("is equivalent to addBusinessDays(_, 1)", () => {
    const start = inZone("2026-05-08T09:00:00", TZ_MSK); // Fri
    const a = nextBusinessDay(start, "mon-fri", TZ_MSK);
    const b = addBusinessDays(start, 1, "mon-fri", TZ_MSK);
    expect(a.getTime()).toBe(b.getTime());
    expectWallClock(a, "2026-05-11T09:00:00", TZ_MSK);
  });

  it("from a non-business day still advances exactly one business day", () => {
    // Saturday in mon-fri → next business day is Monday.
    const start = inZone("2026-05-09T09:00:00", TZ_MSK);
    const got = nextBusinessDay(start, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-11T09:00:00", TZ_MSK);
  });
});

describe("business-date: computeDeadline", () => {
  it("defaults to 18:00 wall-clock in tz", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK); // Mon 09:00
    const got = computeDeadline(start, 4, "mon-fri", TZ_MSK);
    expectWallClock(got, "2026-05-08T18:00:00", TZ_MSK); // Fri 18:00 MSK
  });

  it("discards the hour of periodStart (lands cleanly on HH:00:00.000)", () => {
    const start = inZone("2026-05-04T23:59:59", TZ_MSK);
    const got = computeDeadline(start, 1, "mon-fri", TZ_MSK, 9);
    expectWallClock(got, "2026-05-05T09:00:00", TZ_MSK);
  });

  it("mon-sun with deadlineDays=4 from Monday lands on Friday (calendar +4)", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK);
    const got = computeDeadline(start, 4, "mon-sun", TZ_MSK, 18);
    expectWallClock(got, "2026-05-08T18:00:00", TZ_MSK);
  });

  it("mon-fri vs mon-sun diverge when deadlineDays crosses a weekend", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK); // Mon
    const friMonFri = computeDeadline(start, 5, "mon-fri", TZ_MSK);
    const satMonSun = computeDeadline(start, 5, "mon-sun", TZ_MSK);
    expectWallClock(friMonFri, "2026-05-11T18:00:00", TZ_MSK); // next Mon
    expectWallClock(satMonSun, "2026-05-09T18:00:00", TZ_MSK); // Sat
  });

  it("rejects out-of-range deadlineHour", () => {
    const start = new Date();
    expect(() => computeDeadline(start, 1, "mon-fri", TZ_MSK, 24)).toThrow(
      /deadlineHour/,
    );
    expect(() => computeDeadline(start, 1, "mon-fri", TZ_MSK, -1)).toThrow(
      /deadlineHour/,
    );
    expect(() => computeDeadline(start, 1, "mon-fri", TZ_MSK, 9.5)).toThrow(
      /deadlineHour/,
    );
  });

  it("produces UTC-stable Date (instant equality across zone observers)", () => {
    const start = inZone("2026-05-04T09:00:00", TZ_MSK);
    const got = computeDeadline(start, 4, "mon-fri", TZ_MSK, 18);
    // Fri 2026-05-08 18:00 MSK = 15:00 UTC.
    expect(got.toISOString()).toBe("2026-05-08T15:00:00.000Z");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { seedReferenceDate } from "./seed-reference-date.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("seedReferenceDate", () => {
  it("defaults to the current instant when unset (documented dev convenience)", () => {
    const now = new Date("2026-07-06T12:34:56.789Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("SEED_REFERENCE_DATE", undefined);

    expect(seedReferenceDate()).toEqual(now);
  });

  it.each(["2026-07-06T00:00:00.000Z", "2026-07-06T03:00:00.000+03:00"])(
    "normalizes the explicit ISO instant %s",
    (referenceDate) => {
      vi.stubEnv("SEED_REFERENCE_DATE", referenceDate);

      expect(seedReferenceDate().toISOString()).toBe(
        "2026-07-06T00:00:00.000Z",
      );
    },
  );

  it("accepts a leap day in ISO year 0000", () => {
    vi.stubEnv("SEED_REFERENCE_DATE", "0000-02-29T00:00:00Z");

    expect(seedReferenceDate().toISOString()).toBe("0000-02-29T00:00:00.000Z");
  });

  it.each([
    "not-a-date",
    "July 6, 2026 00:00:00 UTC",
    "2026-07-06T00:00:00",
    "2026-02-30T00:00:00Z",
    "2025-02-29T00:00:00Z",
    "2026-07-06T24:00:00Z",
    "2026-07-06T00:60:00Z",
    "2026-07-06T00:00:60Z",
    "2026-07-06T00:00:00+24:00",
  ])("fails loud on invalid reference %s", (referenceDate) => {
    vi.stubEnv("SEED_REFERENCE_DATE", referenceDate);

    expect(() => seedReferenceDate()).toThrow(
      /SEED_REFERENCE_DATE must be an ISO 8601 instant/,
    );
  });
});

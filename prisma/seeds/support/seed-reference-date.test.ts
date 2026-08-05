import { afterEach, describe, expect, it, vi } from "vitest";

import { seedReferenceDate } from "./seed-reference-date.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("seedReferenceDate", () => {
  it("defaults to the current instant when unset (documented dev convenience)", () => {
    vi.stubEnv("SEED_REFERENCE_DATE", undefined);
    const before = Date.now();
    const result = seedReferenceDate();
    expect(result.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("returns the exact instant from SEED_REFERENCE_DATE", () => {
    vi.stubEnv("SEED_REFERENCE_DATE", "2026-07-06T00:00:00.000Z");
    expect(seedReferenceDate().toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });

  it("fails loud on a malformed reference", () => {
    vi.stubEnv("SEED_REFERENCE_DATE", "not-a-date");
    expect(() => seedReferenceDate()).toThrow(
      /SEED_REFERENCE_DATE must be an ISO 8601 instant/,
    );
  });
});

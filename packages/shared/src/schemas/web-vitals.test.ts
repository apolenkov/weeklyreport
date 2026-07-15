import { describe, expect, it } from "vitest";

import { MAX_WEB_VITAL_VALUE, webVitalBeaconSchema } from "./web-vitals";

describe("webVitalBeaconSchema — value bounds", () => {
  it("rejects a value above the shared maximum", () => {
    expect(() =>
      webVitalBeaconSchema.parse({
        name: "LCP",
        value: MAX_WEB_VITAL_VALUE + 1,
        id: "oversized-sample",
      }),
    ).toThrow();
  });

  it.each([
    ["LCP", 2500],
    ["CLS", 0.1],
    ["FCP", 1800],
    ["INP", 200],
    ["TTFB", 800],
  ] as const)("accepts a realistic %s value", (name, value) => {
    const parsed = webVitalBeaconSchema.parse({
      name,
      value,
      id: `${name.toLowerCase()}-sample`,
    });

    expect(parsed.value).toBe(value);
  });
});

import { describe, expect, it } from "vitest";

import { MAX_WEB_VITAL_VALUE, webVitalBeaconSchema } from "./web-vitals.js";

describe("webVitalBeaconSchema — value bounds", () => {
  it.each([10.0001, MAX_WEB_VITAL_VALUE])(
    "rejects CLS %s at the value field",
    (value) => {
      const result = webVitalBeaconSchema.safeParse({
        name: "CLS",
        value,
        id: "cls",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({ path: ["value"] }),
        );
      }
    },
  );

  it.each([
    ["CLS", 0],
    ["CLS", 10],
    ["LCP", MAX_WEB_VITAL_VALUE],
    ["FCP", MAX_WEB_VITAL_VALUE],
    ["INP", MAX_WEB_VITAL_VALUE],
    ["TTFB", MAX_WEB_VITAL_VALUE],
  ] as const)("accepts the %s input boundary %s", (name, value) => {
    expect(
      webVitalBeaconSchema.parse({ name, value, id: "boundary" }).value,
    ).toBe(value);
  });

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
    ["a negative value", { name: "LCP", value: -1, id: "negative-sample" }],
    ["an empty id", { name: "LCP", value: 1, id: "" }],
    [
      "an unsupported metric name",
      { name: "FID", value: 1, id: "unsupported-sample" },
    ],
  ])("rejects %s", (_label, beacon) => {
    expect(() => webVitalBeaconSchema.parse(beacon)).toThrow();
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

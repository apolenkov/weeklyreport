import { MAX_WEB_VITAL_VALUE } from "@customreport/shared";
import { BadRequestException } from "@nestjs/common";
import type { Histogram } from "@prometheus-io/client";
import { beforeEach, describe, expect, it } from "vitest";

import {
  webVitalCls,
  webVitalFcp,
  webVitalInp,
  webVitalLcp,
  webVitalTtfb,
} from "../../infrastructure/metrics/web-vitals.metrics";
import { WebVitalsController } from "./web-vitals.controller";

const ALL_VITALS = [
  webVitalLcp,
  webVitalCls,
  webVitalFcp,
  webVitalInp,
  webVitalTtfb,
];

// Read the observed `_count` for one navigation_type label off a histogram.
// A recorded sample increments the per-label count; an absent label yields 0.
async function countFor(
  histogram: Histogram<"navigation_type">,
  navigationType: string,
): Promise<number> {
  const metric = await histogram.get();
  const entry = metric.values.find(
    (v) =>
      v.metricName?.endsWith("_count") === true &&
      v.labels.navigation_type === navigationType,
  );
  return entry?.value ?? 0;
}

describe("WebVitalsController.record", () => {
  const controller = new WebVitalsController();

  beforeEach(() => {
    for (const histogram of ALL_VITALS) histogram.reset();
  });

  it("records a well-formed beacon into the matching histogram", async () => {
    controller.record({
      name: "LCP",
      value: 1234.5,
      id: "v1-abc",
      navigationType: "navigate",
    });

    expect(await countFor(webVitalLcp, "navigate")).toBe(1);
  });

  it("rejects a missing value with 400 and records nothing", async () => {
    expect(() => controller.record({ name: "LCP", id: "v1-abc" })).toThrow(
      BadRequestException,
    );

    expect(await countFor(webVitalLcp, "navigate")).toBe(0);
    expect(await countFor(webVitalLcp, "other")).toBe(0);
  });

  it("rejects a non-numeric value with 400 and records nothing", async () => {
    expect(() =>
      controller.record({ name: "LCP", value: "slow", id: "v1-abc" }),
    ).toThrow(BadRequestException);

    expect(await countFor(webVitalLcp, "other")).toBe(0);
  });

  it.each([Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects non-finite value %s with 400 and records nothing",
    async (value) => {
      expect(() =>
        controller.record({
          name: "LCP",
          value,
          id: "x",
        }),
      ).toThrow(BadRequestException);

      expect(await countFor(webVitalLcp, "other")).toBe(0);
    },
  );

  it("rejects a negative value with 400 and records nothing", async () => {
    expect(() =>
      controller.record({ name: "LCP", value: -1e308, id: "x" }),
    ).toThrow(BadRequestException);

    expect(await countFor(webVitalLcp, "other")).toBe(0);
  });

  it("rejects a value above the shared maximum with 400 and records nothing", async () => {
    expect(() =>
      controller.record({
        name: "LCP",
        value: MAX_WEB_VITAL_VALUE + 1,
        id: "oversized",
      }),
    ).toThrow(BadRequestException);

    expect(await countFor(webVitalLcp, "other")).toBe(0);
  });

  it("records a zero value (a valid CLS/timing) into the histogram", async () => {
    controller.record({ name: "CLS", value: 0, id: "cls-zero" });

    expect(await countFor(webVitalCls, "other")).toBe(1);
  });

  it.each([10.0001, MAX_WEB_VITAL_VALUE])(
    "rejects CLS %s with 400 before observing a sample",
    async (value) => {
      let error: unknown;
      try {
        controller.record({ name: "CLS", value, id: "oversized-cls" });
      } catch (error_) {
        error = error_;
      }

      expect(await countFor(webVitalCls, "other")).toBe(0);
      expect(error).toBeInstanceOf(BadRequestException);
      if (error instanceof BadRequestException) {
        expect(error.getStatus()).toBe(400);
      }
    },
  );

  it("records the inclusive CLS input boundary", async () => {
    controller.record({ name: "CLS", value: 10, id: "cls-boundary" });

    expect(await countFor(webVitalCls, "other")).toBe(1);
  });

  it.each([
    ["LCP", webVitalLcp],
    ["FCP", webVitalFcp],
    ["INP", webVitalInp],
    ["TTFB", webVitalTtfb],
  ] as const)(
    "preserves the inclusive %s timing boundary",
    async (name, histogram) => {
      controller.record({
        name,
        value: MAX_WEB_VITAL_VALUE,
        id: "timing-boundary",
      });

      expect(await countFor(histogram, "other")).toBe(1);
    },
  );

  it("rejects an empty id with 400", () => {
    expect(() => controller.record({ name: "LCP", value: 1, id: "" })).toThrow(
      BadRequestException,
    );
  });

  it("rejects an unknown metric name with 400 and records nothing", async () => {
    expect(() =>
      controller.record({ name: "BOGUS", value: 1, id: "v1-abc" }),
    ).toThrow(BadRequestException);

    for (const histogram of ALL_VITALS) {
      expect(await countFor(histogram, "other")).toBe(0);
    }
  });

  it("buckets an unrecognised navigationType under 'other'", async () => {
    controller.record({
      name: "FCP",
      value: 500,
      id: "id-1",
      navigationType: "teleport",
    });

    expect(await countFor(webVitalFcp, "other")).toBe(1);
    expect(await countFor(webVitalFcp, "teleport")).toBe(0);
  });

  it("buckets an absent navigationType under 'other'", async () => {
    controller.record({ name: "INP", value: 120, id: "id-2" });

    expect(await countFor(webVitalInp, "other")).toBe(1);
  });

  it("records a recognised navigationType verbatim", async () => {
    controller.record({
      name: "TTFB",
      value: 300,
      id: "id-3",
      navigationType: "back-forward-cache",
    });

    expect(await countFor(webVitalTtfb, "back-forward-cache")).toBe(1);
  });

  it("accumulates repeated samples into the distribution (not last-write-wins)", async () => {
    for (const value of [100, 400, 1600]) {
      controller.record({
        name: "CLS",
        value: value / 1000,
        id: `cls-${value}`,
        navigationType: "reload",
      });
    }

    const metric = await webVitalCls.get();
    const count = metric.values.find(
      (v) =>
        v.metricName === "web_vital_cls_count" &&
        v.labels.navigation_type === "reload",
    );
    const sum = metric.values.find(
      (v) =>
        v.metricName === "web_vital_cls_sum" &&
        v.labels.navigation_type === "reload",
    );

    expect(count?.value).toBe(3);
    expect(sum?.value).toBeCloseTo(2.1, 5);
  });
});

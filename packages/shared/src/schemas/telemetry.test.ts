import { describe, expect, it } from "vitest";

import { telemetrySummarySchema } from "./telemetry";

describe("telemetrySummarySchema", () => {
  it("accepts a fully-populated summary", () => {
    const ok = telemetrySummarySchema.safeParse({
      reportsThisPeriod: 1,
      onTimeRatio: 0.86,
      activeLeads: 6,
      lateSections: 2,
      pendingReopens: 1,
      pdfExportsLast7d: 12,
      sparkline: [0.8, 0.85, 0.82, 0.86],
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a fresh project with no data yet (onTimeRatio=null, sparkline=[])", () => {
    const ok = telemetrySummarySchema.safeParse({
      reportsThisPeriod: 0,
      onTimeRatio: null,
      activeLeads: 0,
      lateSections: 0,
      pendingReopens: 0,
      pdfExportsLast7d: 0,
      sparkline: [],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects ratio out of [0,1]", () => {
    expect(
      telemetrySummarySchema.safeParse({
        reportsThisPeriod: 0,
        onTimeRatio: 1.5,
        activeLeads: 0,
        lateSections: 0,
        pendingReopens: 0,
        pdfExportsLast7d: 0,
        sparkline: [],
      }).success,
    ).toBe(false);
  });

  it("rejects negative counts", () => {
    expect(
      telemetrySummarySchema.safeParse({
        reportsThisPeriod: -1,
        onTimeRatio: null,
        activeLeads: 0,
        lateSections: 0,
        pendingReopens: 0,
        pdfExportsLast7d: 0,
        sparkline: [],
      }).success,
    ).toBe(false);
  });

  it("rejects sparkline values outside [0,1]", () => {
    expect(
      telemetrySummarySchema.safeParse({
        reportsThisPeriod: 0,
        onTimeRatio: null,
        activeLeads: 0,
        lateSections: 0,
        pendingReopens: 0,
        pdfExportsLast7d: 0,
        sparkline: [0.9, 1.2],
      }).success,
    ).toBe(false);
  });

  // telemetry-summary-contract: the sparkline is the 4-week on-time window;
  // the only producer emits at most 4 points, so the schema bound is ≤ 4.
  it("caps sparkline length at 4 entries (rejects 5, accepts 4)", () => {
    const base = {
      reportsThisPeriod: 0,
      onTimeRatio: null,
      activeLeads: 0,
      lateSections: 0,
      pendingReopens: 0,
      pdfExportsLast7d: 0,
    };
    expect(
      telemetrySummarySchema.safeParse({
        ...base,
        sparkline: Array.from({ length: 5 }, () => 0.9),
      }).success,
    ).toBe(false);
    expect(
      telemetrySummarySchema.safeParse({
        ...base,
        sparkline: Array.from({ length: 4 }, () => 0.9),
      }).success,
    ).toBe(true);
  });
});

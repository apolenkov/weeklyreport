import { describe, expect, it } from 'vitest';

import { telemetrySummarySchema } from '../telemetry';

describe('telemetrySummarySchema (Phase 52 / UFB-054)', () => {
  it('accepts a fully-populated summary', () => {
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

  it('accepts a fresh project with no data yet (onTimeRatio=null, sparkline=[])', () => {
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

  it('rejects ratio out of [0,1]', () => {
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

  it('rejects negative counts', () => {
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

  it('rejects sparkline values outside [0,1]', () => {
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

  it('caps sparkline length at 8 entries', () => {
    const tooLong = Array.from({ length: 9 }, () => 0.9);
    expect(
      telemetrySummarySchema.safeParse({
        reportsThisPeriod: 0,
        onTimeRatio: null,
        activeLeads: 0,
        lateSections: 0,
        pendingReopens: 0,
        pdfExportsLast7d: 0,
        sparkline: tooLong,
      }).success,
    ).toBe(false);
  });
});

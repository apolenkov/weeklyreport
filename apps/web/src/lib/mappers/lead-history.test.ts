import { describe, expect, it } from 'vitest';

import type { MyHistoryEntry } from '@customreport/shared';

import {
  formatDateRange,
  formatSubmittedAt,
  isoWeekNumber,
  mapHistoryEntries,
} from './lead-history';

const baseEntry = (overrides: Partial<MyHistoryEntry> = {}): MyHistoryEntry => ({
  sectionId: '11111111-1111-4111-8111-111111111111',
  reportId: '22222222-2222-4222-8222-222222222222',
  periodStart: new Date('2026-04-14T00:00:00.000Z'),
  periodEnd: new Date('2026-04-20T00:00:00.000Z'),
  reportStatus: 'draft',
  sectionStatus: 'draft',
  submittedAt: null,
  publishedAt: null,
  ...overrides,
});

describe('formatDateRange', () => {
  it("formats a same-month range as 'Apr 14-20'", () => {
    expect(
      formatDateRange(
        new Date('2026-04-14T00:00:00.000Z'),
        new Date('2026-04-20T00:00:00.000Z'),
      ),
    ).toBe('Apr 14-20');
  });

  it("formats a cross-month range as 'Apr 28-May 4'", () => {
    expect(
      formatDateRange(
        new Date('2026-04-28T00:00:00.000Z'),
        new Date('2026-05-04T00:00:00.000Z'),
      ),
    ).toBe('Apr 28-May 4');
  });
});

describe('formatSubmittedAt', () => {
  const now = new Date('2026-04-20T12:00:00.000Z');

  it('returns null for a null input (passthrough)', () => {
    expect(formatSubmittedAt(null, now)).toBeNull();
  });

  it("returns 'just now' for a submission less than a minute old", () => {
    const submitted = new Date(now.getTime() - 30 * 1000);
    expect(formatSubmittedAt(submitted, now)).toBe('just now');
  });

  it("returns 'N min ago' for a submission 2 minutes old", () => {
    const submitted = new Date(now.getTime() - 2 * 60 * 1000);
    expect(formatSubmittedAt(submitted, now)).toBe('2 min ago');
  });

  it("returns '1 hour ago' for a submission exactly 1 hour old (singular)", () => {
    const submitted = new Date(now.getTime() - 60 * 60 * 1000);
    expect(formatSubmittedAt(submitted, now)).toBe('1 hour ago');
  });

  it("returns 'N hours ago' for a submission 5 hours old (plural)", () => {
    const submitted = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    expect(formatSubmittedAt(submitted, now)).toBe('5 hours ago');
  });

  it("formats a multi-day-old submission as a short 'Apr 18' style", () => {
    const submitted = new Date('2026-04-18T15:30:00.000Z');
    expect(formatSubmittedAt(submitted, now)).toBe('Apr 18');
  });
});

describe('isoWeekNumber', () => {
  it('returns 16 for 2026-04-14 (a Tuesday in ISO week 16)', () => {
    expect(isoWeekNumber(new Date('2026-04-14T00:00:00.000Z'))).toBe(16);
  });

  it('returns 1 for 2026-01-05 (Monday of ISO week 2 of 2026)', () => {
    // 2026-01-05 is a Monday in ISO week 2 of 2026.
    expect(isoWeekNumber(new Date('2026-01-05T00:00:00.000Z'))).toBe(2);
  });
});

describe('mapHistoryEntries', () => {
  const now = new Date('2026-04-20T12:00:00.000Z');

  it('returns an empty array for an empty input', () => {
    expect(mapHistoryEntries([], now)).toEqual([]);
  });

  it("maps a draft entry: status='draft' and submittedAt === null", () => {
    const result = mapHistoryEntries(
      [baseEntry({ sectionStatus: 'draft', submittedAt: null })],
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('draft');
    expect(result[0]?.submittedAt).toBeNull();
  });

  it("maps a submitted entry 2 min ago to submittedAt === '2 min ago'", () => {
    const submitted = new Date(now.getTime() - 2 * 60 * 1000);
    const result = mapHistoryEntries(
      [baseEntry({ sectionStatus: 'submitted', submittedAt: submitted })],
      now,
    );
    expect(result[0]?.status).toBe('submitted');
    expect(result[0]?.submittedAt).toBe('2 min ago');
  });

  it("computes dateRange 'Apr 14-20' for a same-month period", () => {
    const result = mapHistoryEntries(
      [
        baseEntry({
          periodStart: new Date('2026-04-14T00:00:00.000Z'),
          periodEnd: new Date('2026-04-20T00:00:00.000Z'),
        }),
      ],
      now,
    );
    expect(result[0]?.dateRange).toBe('Apr 14-20');
  });

  it("computes dateRange 'Apr 28-May 4' for a cross-month period", () => {
    const result = mapHistoryEntries(
      [
        baseEntry({
          periodStart: new Date('2026-04-28T00:00:00.000Z'),
          periodEnd: new Date('2026-05-04T00:00:00.000Z'),
        }),
      ],
      now,
    );
    expect(result[0]?.dateRange).toBe('Apr 28-May 4');
  });

  it("computes weekLabel 'Week 16' from periodStart in ISO week 16", () => {
    const result = mapHistoryEntries(
      [baseEntry({ periodStart: new Date('2026-04-14T00:00:00.000Z') })],
      now,
    );
    expect(result[0]?.weekLabel).toBe('Week 16');
  });

  it('uses sectionId as id and reportId as periodId', () => {
    const result = mapHistoryEntries(
      [
        baseEntry({
          sectionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          reportId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }),
      ],
      now,
    );
    expect(result[0]?.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(result[0]?.periodId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  it('zero-stubs counts and trafficLights (router does not yet project them)', () => {
    const result = mapHistoryEntries([baseEntry()], now);
    expect(result[0]?.itemCount).toBe(0);
    expect(result[0]?.riskCount).toBe(0);
    expect(result[0]?.decisionCount).toBe(0);
    expect(result[0]?.trafficLights).toEqual({ green: 0, yellow: 0, red: 0 });
  });
});

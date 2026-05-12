import { randomUUID as uuid } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { aiSummarySchema } from '../ai-summary';

describe('aiSummarySchema (Phase 54 / UFB-055)', () => {
  it('accepts a mock-source payload with empty summary (no sections)', () => {
    const ok = aiSummarySchema.safeParse({
      summary: '',
      source: 'mock',
      citationIds: [],
    });
    expect(ok.success).toBe(true);
  });

  it('accepts a mock-source payload with summary text and citations', () => {
    const ok = aiSummarySchema.safeParse({
      summary: `[mock-summary] 3 sections, period ${uuid()}`,
      source: 'mock',
      citationIds: [uuid(), uuid()],
    });
    expect(ok.success).toBe(true);
  });

  it('accepts an ai-source payload (forward compatibility for real provider)', () => {
    const ok = aiSummarySchema.safeParse({
      summary: 'Portfolio in green zone; two projects need attention next week.',
      source: 'ai',
      citationIds: [uuid()],
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an unknown source tag', () => {
    expect(
      aiSummarySchema.safeParse({
        summary: 'x',
        source: 'human',
        citationIds: [],
      }).success,
    ).toBe(false);
  });

  it('rejects non-uuid citation ids', () => {
    expect(
      aiSummarySchema.safeParse({
        summary: 'x',
        source: 'mock',
        citationIds: ['not-a-uuid'],
      }).success,
    ).toBe(false);
  });

  it('rejects a missing source field', () => {
    expect(
      aiSummarySchema.safeParse({
        summary: 'x',
        citationIds: [],
      }).success,
    ).toBe(false);
  });

  it('rejects a non-string summary', () => {
    expect(
      aiSummarySchema.safeParse({
        summary: 123,
        source: 'mock',
        citationIds: [],
      }).success,
    ).toBe(false);
  });
});

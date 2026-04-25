import { describe, expect, it } from 'vitest';

import { deriveLeadStatus } from './lead-status';

describe('deriveLeadStatus', () => {
  it("returns 'submitted' for a submitted section regardless of item count", () => {
    expect(
      deriveLeadStatus({ sectionStatus: 'submitted', itemCount: 5 }),
    ).toBe('submitted');
  });

  it("returns 'submitted' for a submitted section with zero items (terminal state)", () => {
    expect(
      deriveLeadStatus({ sectionStatus: 'submitted', itemCount: 0 }),
    ).toBe('submitted');
  });

  it("returns 'draft' for a draft section that has at least one item", () => {
    expect(
      deriveLeadStatus({ sectionStatus: 'draft', itemCount: 3 }),
    ).toBe('draft');
  });

  it("returns 'pending' for a draft section with zero items", () => {
    expect(
      deriveLeadStatus({ sectionStatus: 'draft', itemCount: 0 }),
    ).toBe('pending');
  });

  it("returns 'pending' for an empty draft section (computed presentation-only state)", () => {
    // 'pending' has no DB enum equivalent: it is purely derived from
    // (sectionStatus = 'draft') + (itemCount = 0).
    const result = deriveLeadStatus({ sectionStatus: 'draft', itemCount: 0 });
    expect(result).toBe('pending');
  });

  it("returns 'draft' for a draft section with exactly one item (boundary)", () => {
    expect(
      deriveLeadStatus({ sectionStatus: 'draft', itemCount: 1 }),
    ).toBe('draft');
  });
});

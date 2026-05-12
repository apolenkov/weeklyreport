import { describe, expect, it } from 'vitest';

import {
  legacyTupleToState,
  stateToLegacyTuple,
  initialPeriodState,
} from './period-state.js';

describe('legacyTupleToState (UFB-053)', () => {
  it('archived=true wins over status (archived)', () => {
    expect(
      legacyTupleToState({ status: 'published', archived: true }),
    ).toBe('archived');
    expect(legacyTupleToState({ status: 'draft', archived: true })).toBe(
      'archived',
    );
  });

  it('archived=false AND status=published → published', () => {
    expect(
      legacyTupleToState({ status: 'published', archived: false }),
    ).toBe('published');
  });

  it('archived=false AND status=draft → open (never scheduled)', () => {
    // SCHEDULED is reserved for future periods minted by the creator; it
    // never lands as a backfilled tuple translation.
    expect(legacyTupleToState({ status: 'draft', archived: false })).toBe(
      'open',
    );
  });
});

describe('stateToLegacyTuple (UFB-053)', () => {
  it('archived → (published, true)', () => {
    expect(stateToLegacyTuple('archived')).toEqual({
      status: 'published',
      archived: true,
    });
  });

  it('published → (published, false)', () => {
    expect(stateToLegacyTuple('published')).toEqual({
      status: 'published',
      archived: false,
    });
  });

  it('open → (draft, false)', () => {
    expect(stateToLegacyTuple('open')).toEqual({
      status: 'draft',
      archived: false,
    });
  });

  it('scheduled → (draft, false) — same legacy projection as open', () => {
    // The legacy tuple cannot distinguish scheduled from open — that
    // distinction is what the new column buys us.
    expect(stateToLegacyTuple('scheduled')).toEqual({
      status: 'draft',
      archived: false,
    });
  });
});

describe('initialPeriodState (UFB-053)', () => {
  it('periodStart > now → scheduled', () => {
    expect(
      initialPeriodState(
        new Date('2026-06-01T00:00:00Z'),
        new Date('2026-05-11T00:00:00Z'),
      ),
    ).toBe('scheduled');
  });

  it('periodStart === now → open', () => {
    const t = new Date('2026-05-11T00:00:00Z');
    expect(initialPeriodState(t, t)).toBe('open');
  });

  it('periodStart < now → open', () => {
    expect(
      initialPeriodState(
        new Date('2026-05-04T00:00:00Z'),
        new Date('2026-05-11T00:00:00Z'),
      ),
    ).toBe('open');
  });
});

describe('round-trip invariants (UFB-053)', () => {
  // Round-trip is intentionally lossy: stateToLegacy → legacyToState
  // collapses scheduled → open (no legacy bit to distinguish them).
  // Document the asymmetry as test cases so future maintainers cannot
  // accidentally "fix" it.

  it('archived round-trips cleanly', () => {
    expect(legacyTupleToState(stateToLegacyTuple('archived'))).toBe(
      'archived',
    );
  });

  it('published round-trips cleanly', () => {
    expect(legacyTupleToState(stateToLegacyTuple('published'))).toBe(
      'published',
    );
  });

  it('open round-trips cleanly', () => {
    expect(legacyTupleToState(stateToLegacyTuple('open'))).toBe('open');
  });

  it('scheduled → legacy → open (intentional collapse)', () => {
    expect(legacyTupleToState(stateToLegacyTuple('scheduled'))).toBe('open');
  });
});

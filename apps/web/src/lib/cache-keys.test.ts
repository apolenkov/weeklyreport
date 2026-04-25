/**
 * Phase 22 (plan 22-05) — cache invalidation cascade verification.
 *
 * The plan's Task 2 calls for confirming that `invalidateDashboard` cascades
 * to the queries the head's Publish & Lock flow expects to refresh:
 *   - review.dashboard
 *   - archive.list
 *   - weeklyReport.get
 *
 * We assert against the QueryClient's `invalidateQueries` calls instead of
 * driving a full UI render — the component-level tests already cover that
 * path; this test guarantees the helper itself routes correctly so any future
 * regression in cache-keys.ts is caught here.
 */
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidateAdmin,
} from './cache-keys';
import type { TRPCProxy } from './trpc';

// Build a stub trpc proxy where each `pathFilter()` returns a tagged object so
// we can assert which filters were passed to `invalidateQueries`.
function makeStubTrpc(): TRPCProxy {
  return {
    review: {
      dashboard: { pathFilter: () => ({ tag: 'review.dashboard' }) },
    },
    archive: {
      list: { pathFilter: () => ({ tag: 'archive.list' }) },
    },
    weeklyReport: {
      get: { pathFilter: () => ({ tag: 'weeklyReport.get' }) },
    },
    reports: {
      getActive: { pathFilter: () => ({ tag: 'reports.getActive' }) },
      myHistory: { pathFilter: () => ({ tag: 'reports.myHistory' }) },
    },
    leadForm: {
      byPeriod: { pathFilter: () => ({ tag: 'leadForm.byPeriod' }) },
      versions: { pathFilter: () => ({ tag: 'leadForm.versions' }) },
    },
    admin: {
      snapshot: { pathFilter: () => ({ tag: 'admin.snapshot' }) },
      getSettings: { pathFilter: () => ({ tag: 'admin.getSettings' }) },
    },
  } as unknown as TRPCProxy;
}

describe('cache-keys helpers', () => {
  it('invalidateDashboard fires invalidateQueries for review.dashboard, archive.list, weeklyReport.get', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockReturnValue(Promise.resolve());
    const trpc = makeStubTrpc();

    invalidateDashboard(qc, trpc);

    const tags = spy.mock.calls.map((c) => (c[0] as { tag?: string })?.tag);
    expect(tags).toContain('review.dashboard');
    expect(tags).toContain('archive.list');
    expect(tags).toContain('weeklyReport.get');
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('invalidateLeadForm covers reports.getActive + leadForm.byPeriod + leadForm.versions', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockReturnValue(Promise.resolve());
    invalidateLeadForm(qc, makeStubTrpc());

    const tags = spy.mock.calls.map((c) => (c[0] as { tag?: string })?.tag);
    expect(tags).toEqual(
      expect.arrayContaining([
        'reports.getActive',
        'leadForm.byPeriod',
        'leadForm.versions',
      ]),
    );
  });

  it('invalidateLeadHistory targets reports.myHistory', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockReturnValue(Promise.resolve());
    invalidateLeadHistory(qc, makeStubTrpc());

    expect(spy.mock.calls[0]?.[0]).toEqual({ tag: 'reports.myHistory' });
  });

  it('invalidateAdmin targets admin.snapshot + admin.getSettings', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockReturnValue(Promise.resolve());
    invalidateAdmin(qc, makeStubTrpc());

    const tags = spy.mock.calls.map((c) => (c[0] as { tag?: string })?.tag);
    expect(tags).toEqual(
      expect.arrayContaining(['admin.snapshot', 'admin.getSettings']),
    );
  });
});

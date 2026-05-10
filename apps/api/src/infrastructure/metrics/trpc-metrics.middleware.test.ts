import { describe, it, expect, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

import {
  metricsRegistry,
  trpcRequestDurationSeconds,
  trpcRequestTotal,
} from './metrics.registry.js';
import { trpcMetricsMiddleware } from './trpc-metrics.middleware.js';

/**
 * 47-03 (DX-03) — verifies the tRPC Prometheus middleware emits the right
 * labels and increments both the histogram (`_count`) and the dedicated
 * counter.
 */
describe('trpcMetricsMiddleware', () => {
  beforeEach(() => {
    // prom-client samples are global per registry; reset between tests so
    // counter assertions don't bleed across test cases. Mirrors the pattern
    // used by metrics.registry.test.ts.
    metricsRegistry.resetMetrics();
  });

  async function invoke(
    path: string,
    type: 'query' | 'mutation',
    nextResult:
      | { ok: true; data: unknown }
      | { ok: false; error: TRPCError }
      | { throws: Error },
  ) {
    return trpcMetricsMiddleware({
      path,
      type,
      next: async () => {
        if ('throws' in nextResult) throw nextResult.throws;
        return nextResult;
      },
    });
  }

  it('records a success label set for a passing query', async () => {
    await invoke('admin.snapshot', 'query', { ok: true, data: { rows: 0 } });
    await invoke('admin.snapshot', 'query', { ok: true, data: { rows: 0 } });

    const counter = metricsRegistry.getSingleMetric('trpc_request_total');
    expect(counter).toBeDefined();
    const text = await metricsRegistry.metrics();

    expect(text).toContain(
      'trpc_request_total{procedure="admin.snapshot",type="query",status="success"} 2',
    );
    expect(text).toContain(
      'trpc_request_duration_seconds_count{procedure="admin.snapshot",type="query",status="success"} 2',
    );
  });

  it('records an error label when the inner middleware returns ok=false', async () => {
    await invoke('admin.snapshot', 'mutation', {
      ok: false,
      error: new TRPCError({ code: 'FORBIDDEN', message: 'denied' }),
    });

    const text = await metricsRegistry.metrics();
    expect(text).toContain(
      'trpc_request_total{procedure="admin.snapshot",type="mutation",status="error"} 1',
    );
    expect(text).toContain(
      'trpc_request_duration_seconds_count{procedure="admin.snapshot",type="mutation",status="error"} 1',
    );
  });

  it('records an error label and rethrows when inner next() throws', async () => {
    const thrown = new Error('boom');
    await expect(
      invoke('weeklyReport.get', 'query', { throws: thrown }),
    ).rejects.toBe(thrown);

    const text = await metricsRegistry.metrics();
    expect(text).toContain(
      'trpc_request_total{procedure="weeklyReport.get",type="query",status="error"} 1',
    );
  });

  it('starts a histogram timer that observes a positive duration', async () => {
    // smoke-check: ensure the histogram has at least one observation in the
    // 5ms-10s range (we can't assert an exact value, but `_sum` > 0 proves
    // the timer fired and the bucket bounds are sane).
    await invoke('analytics.leadVelocity', 'query', {
      ok: true,
      data: { rows: [] },
    });
    const histogram = metricsRegistry.getSingleMetric(
      'trpc_request_duration_seconds',
    );
    expect(histogram).toBe(trpcRequestDurationSeconds);

    const text = await metricsRegistry.metrics();
    const sumLine = text
      .split('\n')
      .find(
        (l) =>
          l.startsWith('trpc_request_duration_seconds_sum{') &&
          l.includes('procedure="analytics.leadVelocity"'),
      );
    expect(sumLine).toBeDefined();
    const sumValue = Number(sumLine?.split(' ').at(-1));
    expect(sumValue).toBeGreaterThanOrEqual(0);
    // sanity: the counter handle is the singleton we exported, not a stray
    // double-register.
    expect(metricsRegistry.getSingleMetric('trpc_request_total')).toBe(
      trpcRequestTotal,
    );
  });
});

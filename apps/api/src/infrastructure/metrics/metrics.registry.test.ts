import { describe, it, expect, beforeEach } from 'vitest';

import {
  metricsRegistry,
  dlqFailedTotal,
  rateLimitHitsTotal,
  loginAttemptsTotal,
} from './metrics.registry.js';

describe('37-02 metrics registry', () => {
  beforeEach(async () => {
    // prom-client counters are global. Reset per-test so assertions don't
    // bleed across them. resetMetrics() zeros sample state without
    // unregistering, which is what we want.
    metricsRegistry.resetMetrics();
  });

  it('exposes /metrics output with the three custom counters', async () => {
    dlqFailedTotal.inc({ queue: 'pdf-export' });
    rateLimitHitsTotal.inc({ bucket: 'auth' });
    loginAttemptsTotal.inc({ method: 'saml', outcome: 'success' });

    const text = await metricsRegistry.metrics();

    expect(text).toContain('cr_dlq_failed_total{queue="pdf-export"} 1');
    expect(text).toContain('cr_rate_limit_hits_total{bucket="auth"} 1');
    expect(text).toContain('cr_login_attempts_total{method="saml",outcome="success"} 1');
  });

  it('separates labels into independent series', async () => {
    rateLimitHitsTotal.inc({ bucket: 'auth' });
    rateLimitHitsTotal.inc({ bucket: 'auth' });
    rateLimitHitsTotal.inc({ bucket: 'trpc' });

    const text = await metricsRegistry.metrics();
    expect(text).toContain('cr_rate_limit_hits_total{bucket="auth"} 2');
    expect(text).toContain('cr_rate_limit_hits_total{bucket="trpc"} 1');
  });

  it('counts both login outcomes per method', async () => {
    loginAttemptsTotal.inc({ method: 'saml', outcome: 'success' });
    loginAttemptsTotal.inc({ method: 'saml', outcome: 'fail' });
    loginAttemptsTotal.inc({ method: 'dev-login', outcome: 'success' });

    const text = await metricsRegistry.metrics();
    expect(text).toContain('cr_login_attempts_total{method="saml",outcome="success"} 1');
    expect(text).toContain('cr_login_attempts_total{method="saml",outcome="fail"} 1');
    expect(text).toContain('cr_login_attempts_total{method="dev-login",outcome="success"} 1');
  });

  it('includes Node.js default metrics (process_cpu_user_seconds_total etc.)', async () => {
    const text = await metricsRegistry.metrics();
    // collectDefaultMetrics() is idempotent per registry; one of the
    // standard heap counters should be present.
    expect(text).toMatch(/^# (HELP|TYPE) nodejs_/m);
  });
});

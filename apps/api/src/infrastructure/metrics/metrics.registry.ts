import { Counter, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * 37-02 / 37-03 / 36-01: shared prom-client registry + counter singletons.
 *
 * Every counter referenced by deploy/grafana/customreport-dashboard.json
 * lives here so there's a single import point and a single registration
 * (prom-client throws on double-register otherwise).
 *
 * collectDefaultMetrics() lights up the Node.js standard panel — heap, CPU,
 * GC, event-loop lag.
 */

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

/**
 * 37-02 — every BullMQ job that exhausts its retry budget and lands in the
 * failed-set increments this counter. Read in Grafana via `rate(...)` for
 * a per-second growth signal; an alertmanager rule on top of the absolute
 * value vs DLQ_ALERT_THRESHOLD provides the page.
 */
export const dlqFailedTotal = new Counter({
  name: 'cr_dlq_failed_total',
  help: 'Total BullMQ jobs that exhausted their retry budget',
  labelNames: ['queue'] as const,
  registers: [metricsRegistry],
});

/**
 * 36-01 follow-on — every rate-limit response increments this counter,
 * tagged by bucket (auth | trpc). Lets ops see a brute-force attempt as
 * a spike before the rate-limit log line scrolls off.
 */
export const rateLimitHitsTotal = new Counter({
  name: 'cr_rate_limit_hits_total',
  help: 'Total HTTP responses returned by the rate-limit middleware',
  labelNames: ['bucket'] as const,
  registers: [metricsRegistry],
});

/**
 * 37-02 — every login outcome (saml-callback success/fail, dev-login
 * success). Lets the dashboard distinguish "login attempt rate dropped"
 * (real outage) from "login attempt rate spiked" (brute-force).
 */
export const loginAttemptsTotal = new Counter({
  name: 'cr_login_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['method', 'outcome'] as const,
  registers: [metricsRegistry],
});

import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

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

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

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

/**
 * 47-03 (DX-03) — per-procedure tRPC latency histogram. Labels:
 * - `procedure` — tRPC `path` (e.g. `admin.snapshot`, `weeklyReport.get`)
 * - `type` — `query` | `mutation` | `subscription`
 * - `status` — `success` | `error`
 *
 * Drives the trpc-latency Grafana dashboard (p50/p95/p99 by procedure +
 * top-10 slow + error rate). Bucket boundaries are skewed toward the
 * sub-50ms range because the cached read paths land there; we still
 * cover up to 10s for the slow PDF + Prisma cold-start outliers.
 */
export const trpcRequestDurationSeconds = new Histogram({
  name: 'trpc_request_duration_seconds',
  help: 'tRPC request duration in seconds, labeled by procedure/type/status',
  labelNames: ['procedure', 'type', 'status'] as const,
  buckets: [0.005, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * 47-03 (DX-03) — companion counter to the histogram. Used for the
 * dashboard's request-volume panel and the error-rate stat
 * (`status="error"` over `status=*`). Histogram `_count` could carry
 * the same signal, but a dedicated counter is cheaper to query and the
 * standard Grafana-recipe expression assumes a separate `_total`.
 */
export const trpcRequestTotal = new Counter({
  name: 'trpc_request_total',
  help: 'Total tRPC requests, labeled by procedure/type/status',
  labelNames: ['procedure', 'type', 'status'] as const,
  registers: [metricsRegistry],
});

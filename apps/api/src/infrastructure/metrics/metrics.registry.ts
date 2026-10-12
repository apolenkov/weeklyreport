import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "@prometheus-io/client";

const metricBuckets = (values: readonly string[]): number[] =>
  values.map(Number);

const HTTP_DURATION_BUCKETS = metricBuckets([
  "0.005",
  "0.01",
  "0.025",
  "0.05",
  "0.1",
  "0.25",
  "0.5",
  "1",
  "2.5",
  "5",
  "10",
]);
const TRPC_DURATION_BUCKETS = metricBuckets([
  "0.005",
  "0.025",
  "0.05",
  "0.1",
  "0.25",
  "0.5",
  "1",
  "2.5",
  "5",
  "10",
]);
const SUBMISSION_LATENCY_BUCKETS = metricBuckets([
  "-86400",
  "-43200",
  "-3600",
  "0",
  "3600",
  "14400",
  "43200",
  "86400",
  "259200",
]);

// Shared registration point for application and Node.js process metrics.
// The Prometheus client rejects duplicate names, so every singleton lives here.
export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: HTTP_DURATION_BUCKETS,
  registers: [metricsRegistry],
});

// Counts terminal BullMQ failures for rate-based alerting; absolute queue
// state is tracked separately because events can be missed across restarts.
export const dlqFailedTotal = new Counter({
  name: "cr_dlq_failed_total",
  help: "Total terminal BullMQ job failures, including early unrecoverable ones",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

// SMTP is not transactionally coupled to PostgreSQL. A stale `sending` row
// therefore represents an explicitly unknown delivery outcome, not success.
export const reminderDeliveryUncertainTotal = new Counter({
  name: "cr_reminder_delivery_uncertain_total",
  help: "Reminder executions terminalized because SMTP delivery outcome is unknown",
  registers: [metricsRegistry],
});

// Current BullMQ job depth by queue and state, refreshed from Redis on every
// DLQ-monitor poll so stuck waiting, active, and delayed jobs remain visible.
export const queueDepth = new Gauge({
  name: "cr_queue_depth",
  help: "Current BullMQ job count by queue and state",
  labelNames: ["queue", "state"] as const,
  registers: [metricsRegistry],
});

// Authoritative absolute failed-job count read from each BullMQ queue. Unlike
// the event-driven counter, this gauge remains accurate across monitor restarts.
export const dlqFailedCurrent = new Gauge({
  name: "cr_dlq_failed_current",
  help: "Current authoritative BullMQ failed-job count",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

// Tracks Redis memory against its configured cap so sustained growth is
// visible before Redis or the container reaches its memory limit.
export const redisMemoryUsedBytes = new Gauge({
  name: "cr_redis_memory_used_bytes",
  help: "Current Redis used_memory in bytes, sampled once per DLQ-monitor poll",
  registers: [metricsRegistry],
});

// Splits rate-limit responses by ingress bucket so sustained abuse remains
// visible after individual warning logs expire.
export const rateLimitHitsTotal = new Counter({
  name: "cr_rate_limit_hits_total",
  help: "Total HTTP responses returned by the rate-limit middleware",
  labelNames: ["bucket"] as const,
  registers: [metricsRegistry],
});

// Counts rate-limit Redis store errors while enforcement degrades to a bounded
// per-process store until Redis recovers.
export const rateLimitStoreErrorsTotal = new Counter({
  name: "cr_rate_limit_store_errors_total",
  help: "Rate-limit Redis store errors; local enforcement remains active",
  labelNames: [] as const,
  registers: [metricsRegistry],
});

// Counts session-revocation Redis operations that failed and degraded to the
// fail-open fast path, so an outage is visible even though users are not barred.
export const sessionRevocationFailuresTotal = new Counter({
  name: "cr_session_revocation_failures_total",
  help: "Session-revocation Redis operations that failed (revoke / restore / check)",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

// Separates authentication traffic by method and outcome so outages and
// abusive spikes have distinct signals.
export const loginAttemptsTotal = new Counter({
  name: "cr_login_attempts_total",
  help: "Total authentication attempts",
  labelNames: ["method", "outcome"] as const,
  registers: [metricsRegistry],
});

// Per-procedure latency by path, type, and outcome. Buckets retain detail for
// cached reads while covering slow PDF and Prisma cold-start outliers.
export const trpcRequestDurationSeconds = new Histogram({
  name: "trpc_request_duration_seconds",
  help: "tRPC request duration in seconds, labeled by procedure/type/status",
  labelNames: ["procedure", "type", "status"] as const,
  buckets: TRPC_DURATION_BUCKETS,
  registers: [metricsRegistry],
});

// Companion request-volume counter keeps error-rate queries cheaper than
// aggregating histogram counts.
export const trpcRequestTotal = new Counter({
  name: "trpc_request_total",
  help: "Total tRPC requests, labeled by procedure/type/status",
  labelNames: ["procedure", "type", "status"] as const,
  registers: [metricsRegistry],
});

// Counts report transitions by destination state across manual and automatic
// publication paths.
export const weeklyreportReportsSubmittedTotal = new Counter({
  name: "weeklyreport_reports_submitted_total",
  help: "Total Report state transitions, labelled by destination state",
  labelNames: ["state"] as const,
  registers: [metricsRegistry],
});

// Counts section submissions by the bounded on-time flag stamped at submit
// time, allowing deadline performance to be aggregated without author labels.
export const weeklyreportSectionsSubmittedTotal = new Counter({
  name: "weeklyreport_sections_submitted_total",
  help: "Total section submissions, labelled by on-time flag",
  labelNames: ["late"] as const,
  registers: [metricsRegistry],
});

// Signed deadline distance distinguishes early from late submissions; buckets
// cover the useful range for a weekly reporting cadence.
export const weeklyreportSectionSubmissionLatencySeconds = new Histogram({
  name: "weeklyreport_section_submission_latency_seconds",
  help: "Signed seconds (observation time − deadline), sampled after a successful section submission. Negative = early, positive = late.",
  buckets: SUBMISSION_LATENCY_BUCKETS,
  registers: [metricsRegistry],
});

// Rolling section ratio over four published periods, refreshed lazily by the
// TelemetryGauges scrape callback.
export const weeklyreportReportsOnTimeRatio = new Gauge({
  name: "weeklyreport_reports_on_time_ratio",
  help: "Fraction of submitted sections that were on time over the last 4 published periods",
  registers: [metricsRegistry],
});

// Distinct recent lead authors separates broader engagement from repeated
// submissions by the same people.
export const weeklyreportActiveLeadsTotal = new Gauge({
  name: "weeklyreport_active_leads_total",
  help: "Distinct lead authors who submitted in the most recently published period",
  registers: [metricsRegistry],
});

// Three-state reopen funnel exposes both request demand and approval policy
// without user-level cardinality.
export const weeklyreportReopenRequestsTotal = new Counter({
  name: "weeklyreport_reopen_requests_total",
  help: "Reopen-request lifecycle counter (requested / approved / rejected)",
  labelNames: ["state"] as const,
  registers: [metricsRegistry],
});

// PDF export requests by role support checking whether intended viewers request
// exports directly or rely on heads to export for them.
export const weeklyreportPdfExportRequestsTotal = new Counter({
  name: "weeklyreport_pdf_export_requests_total",
  help: "Total PDF export requests, labelled by requesting role",
  labelNames: ["role"] as const,
  registers: [metricsRegistry],
});

// Period transitions distinguish a stopped publication pipeline from one that
// is merely progressing slowly.
export const weeklyreportPeriodStateTransitionsTotal = new Counter({
  name: "weeklyreport_period_state_transitions_total",
  help: "Period state-machine transitions, labelled by from / to states",
  labelNames: ["from", "to"] as const,
  registers: [metricsRegistry],
});

// Audits cross-author lead-form reads. The result label distinguishes denied
// access from an authorized empty response without exposing payload content.
export const weeklyreportCrossAuthorContentReadsTotal = new Counter({
  name: "weeklyreport_cross_author_content_reads_total",
  help: "Full-content cross-author lead-form reads, labelled by authorization result (allowed / denied / empty)",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

// Counts durable mutation-audit rows that failed to persist. Audit rows are
// security-relevant: a dropped record must stay visible as a rising series,
// not only as a per-event log line.
export const auditPersistFailuresTotal = new Counter({
  name: "weeklyreport_audit_persist_failures_total",
  help: "Durable user-action-log writes that failed and were dropped",
  labelNames: [] as const,
  registers: [metricsRegistry],
});

// Counts shared Redis read-through-cache operations that degraded
// (validation / parse / read / write / scan failures). Cache reads stay
// fail-safe, so this counter reports cache degradation and errors only — it
// does not track successful cache hits.
export const redisCacheErrorsTotal = new Counter({
  name: "weeklyreport_redis_cache_errors_total",
  help: "Redis read-through-cache operations that degraded (validation / parse / read / write / scan / delete / connection); not successful cache hits",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
});

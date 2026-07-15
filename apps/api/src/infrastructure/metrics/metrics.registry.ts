import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

/**
 * Shared registration point for application and Node.js process metrics.
 * prom-client rejects duplicate names, so every singleton lives here.
 */
export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Counts terminal BullMQ failures for rate-based alerting; absolute queue
 * state is tracked separately because events can be missed across restarts.
 */
export const dlqFailedTotal = new Counter({
  name: "cr_dlq_failed_total",
  help: "Total BullMQ jobs that exhausted their retry budget",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

/**
 * Current BullMQ job depth by queue and state, refreshed from Redis on every
 * DLQ-monitor poll so stuck waiting, active, and delayed jobs remain visible.
 */
export const queueDepth = new Gauge({
  name: "cr_queue_depth",
  help: "Current BullMQ job count by queue and state",
  labelNames: ["queue", "state"] as const,
  registers: [metricsRegistry],
});

/**
 * Authoritative absolute failed-job count read from each BullMQ queue. Unlike
 * the event-driven counter, this gauge remains accurate across monitor restarts.
 */
export const dlqFailedCurrent = new Gauge({
  name: "cr_dlq_failed_current",
  help: "Current authoritative BullMQ failed-job count",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

/**
 * Tracks Redis memory against its configured cap so sustained growth is
 * visible before Redis or the container reaches its memory limit.
 */
export const redisMemoryUsedBytes = new Gauge({
  name: "cr_redis_memory_used_bytes",
  help: "Current Redis used_memory in bytes, sampled once per DLQ-monitor poll",
  registers: [metricsRegistry],
});

/**
 * Splits rate-limit responses by ingress bucket so sustained abuse remains
 * visible after individual warning logs expire.
 */
export const rateLimitHitsTotal = new Counter({
  name: "cr_rate_limit_hits_total",
  help: "Total HTTP responses returned by the rate-limit middleware",
  labelNames: ["bucket"] as const,
  registers: [metricsRegistry],
});

/**
 * Separates authentication traffic by method and outcome so outages and
 * abusive spikes have distinct signals.
 */
export const loginAttemptsTotal = new Counter({
  name: "cr_login_attempts_total",
  help: "Total authentication attempts",
  labelNames: ["method", "outcome"] as const,
  registers: [metricsRegistry],
});

/**
 * Per-procedure latency by path, type, and outcome. Buckets retain detail for
 * cached reads while covering slow PDF and Prisma cold-start outliers.
 */
export const trpcRequestDurationSeconds = new Histogram({
  name: "trpc_request_duration_seconds",
  help: "tRPC request duration in seconds, labeled by procedure/type/status",
  labelNames: ["procedure", "type", "status"] as const,
  buckets: [0.005, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Companion request-volume counter keeps error-rate queries cheaper than
 * aggregating histogram counts.
 */
export const trpcRequestTotal = new Counter({
  name: "trpc_request_total",
  help: "Total tRPC requests, labeled by procedure/type/status",
  labelNames: ["procedure", "type", "status"] as const,
  registers: [metricsRegistry],
});

// Product metrics retain the `customreport_*` prefix to avoid re-baselining
// existing dashboards and SLO time series.

/**
 * Counts report transitions by destination state across manual and automatic
 * publication paths.
 */
export const customreportReportsSubmittedTotal = new Counter({
  name: "customreport_reports_submitted_total",
  help: "Total Report state transitions, labelled by destination state",
  labelNames: ["state"] as const,
  registers: [metricsRegistry],
});

/**
 * Counts section submissions by the bounded on-time flag stamped at submit
 * time, allowing deadline performance to be aggregated without author labels.
 */
export const customreportSectionsSubmittedTotal = new Counter({
  name: "customreport_sections_submitted_total",
  help: "Total section submissions, labelled by on-time flag",
  labelNames: ["late"] as const,
  registers: [metricsRegistry],
});

/**
 * Signed deadline distance distinguishes early from late submissions; buckets
 * cover the useful range for a weekly reporting cadence.
 */
export const customreportSectionSubmissionLatencySeconds = new Histogram({
  name: "customreport_section_submission_latency_seconds",
  help: "Signed seconds (deadline − submittedAt) at submit time. Negative = early, positive = late.",
  buckets: [-86_400, -43_200, -3600, 0, 3600, 14_400, 43_200, 86_400, 259_200],
  registers: [metricsRegistry],
});

/**
 * Rolling section ratio over four published periods, refreshed lazily by the
 * TelemetryGauges scrape callback.
 */
export const customreportReportsOnTimeRatio = new Gauge({
  name: "customreport_reports_on_time_ratio",
  help: "Fraction of submitted sections that were on time over the last 4 published periods",
  registers: [metricsRegistry],
});

/**
 * Distinct recent lead authors separates broader engagement from repeated
 * submissions by the same people.
 */
export const customreportActiveLeadsTotal = new Gauge({
  name: "customreport_active_leads_total",
  help: "Distinct lead authors who submitted in the most recently published period",
  registers: [metricsRegistry],
});

/**
 * Three-state reopen funnel exposes both request demand and approval policy
 * without user-level cardinality.
 */
export const customreportReopenRequestsTotal = new Counter({
  name: "customreport_reopen_requests_total",
  help: "Reopen-request lifecycle counter (requested / approved / rejected)",
  labelNames: ["state"] as const,
  registers: [metricsRegistry],
});

/**
 * PDF export requests, labelled by requesting role. Engagement
 * signal: a healthy product sees viewers + heads pulling exports.
 */
export const customreportPdfExportRequestsTotal = new Counter({
  name: "customreport_pdf_export_requests_total",
  help: "Total PDF export requests, labelled by requesting role",
  labelNames: ["role"] as const,
  registers: [metricsRegistry],
});

/**
 * Period transitions distinguish a stopped publication pipeline from one that
 * is merely progressing slowly.
 */
export const customreportPeriodStateTransitionsTotal = new Counter({
  name: "customreport_period_state_transitions_total",
  help: "Period state-machine transitions, labelled by from / to states",
  labelNames: ["from", "to"] as const,
  registers: [metricsRegistry],
});

/**
 * Audits cross-author lead-form reads. The result label distinguishes denied
 * access from an authorized empty response without exposing payload content.
 */
export const customreportCrossAuthorContentReadsTotal = new Counter({
  name: "customreport_cross_author_content_reads_total",
  help: "Full-content cross-author lead-form reads, labelled by authorization result (allowed / denied / empty)",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

// Telegram delivery and binding lifecycle metrics.

/**
 * Tracks Telegram delivery outcomes so silent failures are visible before
 * users report missed notifications.
 */
export const telegramMessageSentTotal = new Counter({
  name: "customreport_telegram_message_sent_total",
  help: "Total outbound Telegram message attempts",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

/**
 * Tracks binding creation, deletion, and reactivation without user labels.
 */
export const telegramBindingTotal = new Counter({
  name: "customreport_telegram_binding_total",
  help: "Telegram user binding lifecycle events",
  labelNames: ["event"] as const,
  registers: [metricsRegistry],
});

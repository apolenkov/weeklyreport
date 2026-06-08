import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

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
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
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
  name: "cr_dlq_failed_total",
  help: "Total BullMQ jobs that exhausted their retry budget",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

/**
 * 36-01 follow-on — every rate-limit response increments this counter,
 * tagged by bucket (auth | trpc). Lets ops see a brute-force attempt as
 * a spike before the rate-limit log line scrolls off.
 */
export const rateLimitHitsTotal = new Counter({
  name: "cr_rate_limit_hits_total",
  help: "Total HTTP responses returned by the rate-limit middleware",
  labelNames: ["bucket"] as const,
  registers: [metricsRegistry],
});

/**
 * 37-02 — every login outcome (saml-callback success/fail, dev-login
 * success). Lets the dashboard distinguish "login attempt rate dropped"
 * (real outage) from "login attempt rate spiked" (brute-force).
 */
export const loginAttemptsTotal = new Counter({
  name: "cr_login_attempts_total",
  help: "Total authentication attempts",
  labelNames: ["method", "outcome"] as const,
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
  name: "trpc_request_duration_seconds",
  help: "tRPC request duration in seconds, labeled by procedure/type/status",
  labelNames: ["procedure", "type", "status"] as const,
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
  name: "trpc_request_total",
  help: "Total tRPC requests, labeled by procedure/type/status",
  labelNames: ["procedure", "type", "status"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// Phase 52 — Product / business-KPI telemetry (UFB-054).
//
// Distinct from the engineering telemetry above (which measures
// latency / errors / DLQ / login). The metrics below answer
// leadership-readable questions: how many reports landed on time,
// which roles miss deadlines, how many reopens we churn through,
// who actually opens PDFs.
//
// Prefix `customreport_*` per phase-spec, even though the existing
// counters use `cr_*`. The mismatch is a deferred consolidation
// (renaming existing counters would re-baseline production SLOs,
// which is out of scope here). Tracked in the phase SUMMARY.
// ============================================================

/**
 * 52-A — every Report transition into the `published` state increments
 * this counter (whether driven by an explicit `publishReport` action or
 * the auto-publisher cron). Labelled by `state` so future expansion
 * (e.g. `state='archived'`) does not require a new counter.
 */
export const customreportReportsSubmittedTotal = new Counter({
  name: "customreport_reports_submitted_total",
  help: "Total Report state transitions, labelled by destination state",
  labelNames: ["state"] as const,
  registers: [metricsRegistry],
});

/**
 * 52-A — every ReportSection submission. `late` is the on-time flag
 * stamped at submit time by ReportSectionsService (`now > deadline`).
 * The two-label cardinality (late=true|false) keeps the series count
 * bounded; aggregating with `sum by (late)` answers the «how often do
 * we miss the deadline» question.
 */
export const customreportSectionsSubmittedTotal = new Counter({
  name: "customreport_sections_submitted_total",
  help: "Total section submissions, labelled by on-time flag",
  labelNames: ["late"] as const,
  registers: [metricsRegistry],
});

/**
 * 52-A — signed-seconds histogram of (deadline − submittedAt). Negative
 * buckets surface how far in advance leads typically submit;
 * positive buckets surface how late they are when they slip.
 *
 * Bucket choice is calibrated for a weekly cadence with an 18:00
 * deadline: -1d / -12h / -1h / 0 / +1h / +4h / +12h / +1d / +3d.
 */
export const customreportSectionSubmissionLatencySeconds = new Histogram({
  name: "customreport_section_submission_latency_seconds",
  help: "Signed seconds (deadline − submittedAt) at submit time. Negative = early, positive = late.",
  buckets: [-86_400, -43_200, -3600, 0, 3600, 14_400, 43_200, 86_400, 259_200],
  registers: [metricsRegistry],
});

/**
 * 52-A — rolling on-time ratio (last 4 published periods, per
 * ReportSection because that is what the head dashboard's «late» badge
 * reflects). Set by a `collect` async callback in TelemetryGauges so
 * the value refreshes lazily at Prometheus scrape time — no scheduler.
 */
export const customreportReportsOnTimeRatio = new Gauge({
  name: "customreport_reports_on_time_ratio",
  help: "Fraction of submitted sections that were on time over the last 4 published periods",
  registers: [metricsRegistry],
});

/**
 * 52-A — distinct lead authors who submitted in the most recently
 * published period. Engagement signal; pairs with reports_submitted_total
 * to distinguish «volume up because more leads» from «volume up because
 * the same leads filed twice».
 */
export const customreportActiveLeadsTotal = new Gauge({
  name: "customreport_active_leads_total",
  help: "Distinct lead authors who submitted in the most recently published period",
  registers: [metricsRegistry],
});

/**
 * 52-A — reopen-request funnel. `state ∈ {requested, approved, rejected}`.
 * `requested` fires from LeadFormService.requestReopen; `approved` and
 * `rejected` fire from the admin.respondReopenRequest mutation. The
 * three-state funnel exposes both demand (requested rate) and the
 * head's policy stance (approve/reject ratio).
 */
export const customreportReopenRequestsTotal = new Counter({
  name: "customreport_reopen_requests_total",
  help: "Reopen-request lifecycle counter (requested / approved / rejected)",
  labelNames: ["state"] as const,
  registers: [metricsRegistry],
});

/**
 * 52-A — PDF export requests, labelled by requesting role. Engagement
 * signal: a healthy product sees viewers + heads pulling exports.
 */
export const customreportPdfExportRequestsTotal = new Counter({
  name: "customreport_pdf_export_requests_total",
  help: "Total PDF export requests, labelled by requesting role",
  labelNames: ["role"] as const,
  registers: [metricsRegistry],
});

/**
 * 52-A — period state-machine transitions (`from` → `to`). Covers
 * `open → published` (manual + auto), and any future archival
 * transitions plumbed in. Lets ops distinguish a stuck pipeline
 * («no published transitions in 7d») from a slow one.
 */
export const customreportPeriodStateTransitionsTotal = new Counter({
  name: "customreport_period_state_transitions_total",
  help: "Period state-machine transitions, labelled by from / to states",
  labelNames: ["from", "to"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// Phase 55 (Telegram) — day-1 metrics per TODO discipline rule.
// Declared here even while MockTelegramAdapter is the only path.
// ============================================================

/**
 * 55 — every outbound Telegram message attempt. `status` is `ok` |
 * `error`. Lets ops chart message delivery rate and detect silent
 * failures before users notice missed notifications.
 */
export const telegramMessageSentTotal = new Counter({
  name: "customreport_telegram_message_sent_total",
  help: "Total outbound Telegram message attempts",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

/**
 * 55 — user ↔ bot binding lifecycle events. `event` is
 * `created` | `deleted` | `reactivated`. Lets ops see how many
 * users have active Telegram bindings and whether the /start flow
 * is being used.
 */
export const telegramBindingTotal = new Counter({
  name: "customreport_telegram_binding_total",
  help: "Telegram user binding lifecycle events",
  labelNames: ["event"] as const,
  registers: [metricsRegistry],
});

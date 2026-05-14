# Phase 37: Observability Completion — Context

**Gathered:** 2026-05-05 (post-hoc scaffold; no plans started — fresh phase for autonomous run)
**Status:** Ready for planning
**Mode:** Post-hoc scaffold — full milestone detail in `.planning/milestones/v8.0-ROADMAP.md`

<domain>
## Phase Boundary

Surface the operational signal we already collect:

- DLQ metrics live in BullMQ but no alert rule fires on growth.
- /metrics endpoint exists (prom-client default metrics) but Prometheus scrape config doesn't.
- Audit logger writes structured JSON to file (rotated, compressed) but no log-sink doc explains how to ship to Loki/Splunk/Datadog.
- No distributed tracing: a slow tRPC request in prod is a black box.

In scope: OTel HTTP middleware + Prisma instrumentation (OTLP/HTTP exporter, env-configurable endpoint, sampling=0.1 default); BullMQ DLQ alert rule firing structured ERROR + Prometheus counter `cr_dlq_failed_total{queue}`; `deploy/prometheus.yml` scrape config + Grafana dashboard JSON skeleton; `deploy/log-sink/` vector + promtail config templates.

Out of scope: live Loki/Datadog provisioning (org-side); fancy dashboards beyond skeleton; alert routing rules for PagerDuty/Slack (org-side).
</domain>

<decisions>
## Implementation Decisions

- **OTel sampling:** 0.1 default (10% of traces) to limit prod overhead. Env override `OTEL_TRACES_SAMPLER_ARG` lets staging crank to 1.0. Full disable via `OTEL_SDK_DISABLED=true`.
- **OTLP/HTTP not gRPC:** simpler firewall story; no native bindings to compile in the Dockerfile.api image.
- **DLQ alert at counter level, not log scrape:** Prometheus counter `cr_dlq_failed_total{queue=...}` is the source of truth; alerting rule fires when counter rate > 0.
- **Grafana skeleton, not full dashboard:** 4 panels (HTTP req rate, p95 latency, DLQ failed total, login attempts rate). Org tunes from there.
- **Log-sink as docs+templates only:** Phase 37 ships vector + promtail config templates pointing at the rotated JSON log file (apilogs volume from Phase 38-01). Real Loki/Splunk endpoint config is org-side.

</decisions>

<code_context>

## Existing Code Insights

- `apps/api/src/infrastructure/metrics/metrics.controller.ts` mounts `/metrics` via `prom-client`. 37-02 extends with custom counters.
- `apps/api/src/lib/logger.ts` writes structured JSON to `${LOG_DIR}/app.log` with rotation+gzip+30d retention. 37-04 documents how to point a sidecar at this file.
- `apps/api/src/main.ts` middleware ordering matters for OTel — must register BEFORE rate-limiter (Phase 36-01) so traces capture rate-limit denials too.
- `docker-compose.observability.yml` will be a new file alongside docker-compose.prod.yml; brings up Prometheus + Grafana for local validation.

</code_context>

<specifics>
## Specific Ideas

- 37-01 OTel: `@opentelemetry/sdk-node` + `@opentelemetry/instrumentation-http` + `@opentelemetry/instrumentation-express`. Prisma has built-in tracing via `previewFeatures = ["tracing"]` already on; just need exporter wiring.
- 37-02 DLQ alert: hooks into existing emailReminderQueue Queue handle in main.ts; runs every minute via `@Cron`; computes failed-job count, increments counter, logs warn if delta > 0.
- 37-03 Prometheus scrape: scrapes `api:3002/metrics` every 15s; Grafana dashboard JSON imported via UI or provisioning file.

</specifics>

<deferred>
## Deferred Ideas

- Tail-sampling exporter (k8s-native) — defer to v8.1 when OTel collector deployment lands.
- Custom traces around AI calls (per-prompt latency) — Phase 31 already produces minimal AI logs; tracing layer can come later.
- SLO dashboards — needs 30 days of production data first.

</deferred>

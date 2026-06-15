# Correlate Bugsink Errors to OTel Traces (Sentry-skeleton, variant A)

Status: captured 2026-06-15, NOT started. Plan locked via grill-with-docs-codex
(Codex APPROVED at round 3/5). See `PLAN.md`, `PLAN-REVIEW-LOG.md`, and
`docs/adr/0002-telemetry-sentry-skeleton-lgtm-backends.md`. Re-verify wiring
before implementing.

## Why

Errors go to Bugsink (a self-hosted, Sentry-compatible **error tracker** — not an
APM). Traces/logs/metrics go to the bundled `grafana/otel-lgtm` stack
(Tempo/Loki/Prometheus). The two halves share no identifier today: a Bugsink
error and its Tempo trace cannot be linked, so you cannot pivot from "this
request failed" to "here is its full trace". The latent OTel→Tempo export was
itself silently broken until 2026-06-15 (Sentry v10 installed its own global
TracerProvider; fixed with `skipOpenTelemetrySetup: true`).

Variant B (a real Sentry product as the single backend) was rejected (ADR-0002):
SaaS cost + corporate data egress, or ~10-service self-host, and weaker metrics
than Prometheus — unjustified for an internal weekly-report MVP.

## What Changes

Make the **Sentry SDK the instrumentation skeleton** while keeping LGTM as the
backends, so **every in-request error in Bugsink carries the trace id of its OTel
trace** (correlation by shared id, not a single pane, not a browser→api
waterfall).

- **Backend:** a `beforeSend` deterministically stamps the active OTel span's
  `trace_id`/`span_id` onto the error event; `beforeSendTransaction:()=>null`
  guards Bugsink against transactions. The Tempo NodeSDK exporter/sampler is
  unchanged; only a composite W3C+Sentry `textMapPropagator` is added for
  browser→api trace adoption (W3C wins when both headers are present).
- **Frontend:** update the existing Sentry files (they already exist) — add
  `onRequestError`, migrate to a single canonical `instrumentation-client.ts`,
  add the transaction guard to every init, enable browser tracing only enough to
  emit propagation headers to same-origin `/trpc`/`/auth`/`/api`.
- **Errors without an active span** (boot, background jobs, unhandled rejections)
  are sent without trace context — by design.

## Impact

- Affected code: `apps/api/src/main.ts`,
  `apps/api/src/infrastructure/otel/otel.bootstrap.ts`, `apps/api/package.json`,
  `apps/web/sentry.*.config.ts`, `apps/web/instrumentation.ts`,
  `apps/web/instrumentation-client.ts` (new canonical), `apps/web/next.config.ts`.
- Affected spec: ADDS capability `error-trace-correlation`.
- Out of scope: browser spans as Tempo waterfalls; variant B; metrics/logs
  pipeline changes; production sampling tuning.

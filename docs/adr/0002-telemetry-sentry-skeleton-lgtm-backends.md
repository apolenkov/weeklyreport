---
status: accepted
---

# Sentry SDK as the instrumentation skeleton, LGTM stack as the backends

The app emits three telemetry signals — errors, traces, logs — plus scraped
metrics. Errors go to **Bugsink** (a self-hosted, Sentry-compatible **error
tracker** — not an APM; it cannot store traces or metrics). Traces, logs, and
metrics go to the bundled **LGTM stack** (`grafana/otel-lgtm` = Loki, Grafana,
Tempo, Prometheus). Until now the two halves were uncorrelated: a Bugsink error
and its Tempo trace had no shared identifier, so you could not pivot from "this
request failed" to "here is its full trace".

We decided to make the **Sentry SDK the single instrumentation skeleton** and
keep the **LGTM stack as the telemetry backends**, rather than consolidating
everything into one Sentry product.

- The Sentry Node SDK (v8+, OpenTelemetry-based) owns the api's OTel pipeline:
  errors → Bugsink **carrying trace context**, traces → Tempo, logs → Loki,
  metrics → Prometheus (unchanged scrape).
- The frontend uses the Sentry browser SDK for errors → Bugsink and **propagates
  trace headers** to the api, so the api's Tempo trace inherits the browser's
  trace id.
- The win is **error↔trace correlation by a shared trace id**, not a single pane
  of glass.

## Why

The realistic alternative (variant B) was to adopt a real Sentry **product** as
the one backend for everything. We rejected it: Sentry SaaS means recurring cost
and egress of internal corporate data to the cloud; self-hosted Sentry is ~10
services (Postgres, Kafka, ClickHouse, Redis, …) to operate; and either way the
metrics story is weaker than the Prometheus stack already in place. For an
internal weekly-report MVP with no production point yet, that is unjustified
operational and financial weight to close a gap that variant A closes for free.

This is hard to reverse cheaply (it shapes every `Sentry.init` and the OTel
bootstrap across api and web) and surprising without context (a future reader
will ask "why is Sentry wired but traces live in Grafana, not Sentry?"), which is
why it is recorded here.

## Consequences

- Bugsink stays errors-only; browser spans never reach a trace backend
  (correlation is by shared id, not a browser→api waterfall). Browser spans in
  Tempo would need a separate `sdk-trace-web` + CORS-OTLP stack — out of scope.
- The Sentry SDK must run with `skipOpenTelemetrySetup: true` so the app's own
  NodeSDK owns tracing; otherwise Sentry's auto-installed global TracerProvider
  wins and starves Tempo of spans (the bug that motivated this work).
- Transactions must be suppressed from Bugsink (`beforeSendTransaction: () =>
null`) since it cannot store them.

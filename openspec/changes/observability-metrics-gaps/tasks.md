## 1. Queue-depth + DLQ authoritative-count gauges

- [x] 1.1 `apps/api/src/infrastructure/metrics/metrics.registry.ts`: add a
      `cr_queue_depth` `Gauge` labeled `["queue", "state"]` (state ∈
      `waiting`/`active`/`delayed`)
- [x] 1.2 `apps/api/src/infrastructure/metrics/metrics.registry.ts`: add a
      `cr_dlq_failed_current` `Gauge` labeled `["queue"]` for the
      authoritative absolute failed-job count (distinct from the existing
      `cr_dlq_failed_total` rate counter)
- [x] 1.3 `apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts`: in the
      existing `POLL_INTERVAL_MS` poll loop, call `getJobCounts()` per
      registered queue (via `QueueRegistry`) and set `cr_queue_depth` for
      each state
- [x] 1.4 Same poll loop: set `cr_dlq_failed_current` from the existing
      `getFailedCount()` call (currently log-only) instead of/alongside the
      threshold-comparison log line
- [x] 1.5 Unit test: stub `QueueRegistry`/`Queue.getJobCounts()`, trigger one
      poll cycle, assert both gauges are set to the stubbed values

## 2. Per-procedure OTel span

- [x] 2.1 `apps/api/src/infrastructure/metrics/trpc-metrics.middleware.ts`:
      wrap the existing `next()` call with an OTel child span
      (`trace.getTracer(...).startActiveSpan(path, ...)`), setting
      `type`/`status` as span attributes, ending the span in the same
      success/error paths the Prometheus timer already handles
- [x] 2.2 Confirm span creation is a no-op (not a hard error) when
      `OTEL_SDK_DISABLED` or no exporter endpoint is configured — the OTel
      API returns a no-op tracer in that state by default; verify this
      holds rather than assuming it
- [ ] 2.3 Manual verification (see proposal Verification section): batched
      tRPC request against a local collector shows N child spans

## 3. `bullmq.health` timeout

- [x] 3.1 `apps/api/src/infrastructure/health/bullmq.health.ts`: wrap the
      `Promise.all([pdfQueue.getJobCounts(), emailQueue.getJobCounts()])`
      call in a `Promise.race` against a bounded timeout (reuse or match
      `redis.health`'s existing timeout constant/pattern)
- [x] 3.2 On timeout, resolve `down()` with a message indicating the
      job-count probe timed out, distinct from the existing catch-based
      `down()` for a thrown error
- [x] 3.3 Unit test: stub `getJobCounts()` to never resolve, assert
      `isHealthy()` resolves `down()` within the bound instead of hanging
      the test

## 4. On-time-ratio gauge reset

- [x] 4.1 `apps/api/src/modules/telemetry/telemetry.gauges.ts`: in
      `onTimeRatio.collect`, add an `else` branch (or restructure the
      conditional) that clears the gauge (`.set(NaN)` or the prom-client
      `reset()` equivalent) when `onTimeRatioLastNPeriods` returns `null`
- [x] 4.2 Unit test: seed a has-data response, assert `.set(value)`; then
      seed a no-data (`null`) response on a second collect, assert the
      gauge no longer reports the prior value

## 5. `traceparent` propagation, web to API

- [x] 5.1 Locate the web app's tRPC client construction (shared HTTP
      link/fetch wrapper) and add a `traceparent` header derived from the
      active OTel web-instrumentation context, if one is already
      instrumented client-side — otherwise inject a manually-constructed
      W3C trace-context header per request as a minimal correlation ID
      (implementation decides scope: full client OTel SDK vs. a lightweight
      header injector, document the choice)
- [x] 5.2 Confirm the API's `HttpInstrumentation`
      (`otel.bootstrap.ts`, already wired with `W3CTraceContextPropagator`)
      picks up the incoming header and continues the trace rather than
      starting a new root span
- [ ] 5.3 Browser/Playwright verification: confirm an outgoing request
      carries `traceparent` and the resulting server span is a child of the
      client-originated trace

## 6. Gates and verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.3 Metrics scrape check: boot the API from source, `curl
localhost:3001/metrics`, confirm `cr_queue_depth` and
      `cr_dlq_failed_current` appear
- [x] 6.4 `openspec validate observability-metrics-gaps --strict`

## Why

BL-27 (P2, `docs/reviews/repo-excellence-review-2026-07-14.md`) plus one
council-confirmed miss folded into it:

> **BL-27** P2 — observability-слепые пятна: нет gauge глубины очередей
> (застрявший job невидим — тот самый «почему отчёт завис»); DLQ
> event-driven undercount; нет per-procedure OTel-span; `bullmq.health` без
> таймаута; on-time-ratio gauge не сбрасывается. Сюда же council/GLM (Low):
> нет проброса W3C `traceparent` web→API.

Every sub-finding verified directly against the code before writing this
proposal:

- **No queue-depth gauge.** `apps/api/src/infrastructure/metrics/metrics.registry.ts`
  has `dlqFailedTotal` (Counter) and `redisMemoryUsedBytes` (Gauge) but no
  gauge for `waiting`/`active`/`delayed` job counts per queue.
  `DLQMonitorService` (`apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts`)
  already polls `getJobCounts()`-adjacent Redis state every 60s
  (`POLL_INTERVAL_MS`) for the memory gauge — the queue-depth numbers are one
  more field on an existing poll, not a new subsystem.
- **DLQ undercount.** `dlqFailedTotal` only increments on a live
  `QueueEvents` `"failed"` listener (`dlq-monitor.service.ts` `onModuleInit`)
  — a monitor restart misses any `"failed"` events emitted while it was
  down. The authoritative absolute count (`getFailedCount()`, referenced in
  the class's own doc comment as backing the periodic threshold-log) is
  logged but never exported as a gauge, so the counter and the log-only
  absolute count can diverge and nothing in Prometheus reflects the
  authoritative number.
- **No per-procedure OTel span.** `apps/api/src/infrastructure/otel/otel.bootstrap.ts`
  wires `ExpressInstrumentation` + `HttpInstrumentation`, which instrument at
  the HTTP-request level. tRPC batches multiple procedures into one
  `POST /trpc` HTTP request, so N procedures collapse under one Express
  span. `trpc-metrics.middleware.ts` (invoked from `trpc.middleware.ts`)
  already has the exact per-procedure seam — `path`/`type`/`next()` — used
  today for the `trpc_request_duration_seconds` Prometheus histogram, but it
  creates no OTel span, so traces don't get the same per-procedure
  breakdown metrics already have.
- **`bullmq.health` unbounded await.** `apps/api/src/infrastructure/health/bullmq.health.ts`
  awaits `Promise.all([pdfQueue.getJobCounts(), emailQueue.getJobCounts()])`
  with no timeout; a wedged Redis connection hangs the health check
  indefinitely. Contrast noted in the finding: `redis.health` uses a bounded
  ping.
- **On-time-ratio gauge staleness.** `apps/api/src/modules/telemetry/telemetry.gauges.ts`'s
  `onTimeRatio.collect` callback only calls `.set(value)` when
  `value !== null`; on a has-data→no-data transition (e.g. after a DB reset
  or during the review's disposable-DB MVP workflow) the gauge keeps
  exporting its last-set value forever instead of clearing, confirmed by
  reading the callback: no `else` branch resets or unsets the gauge.
- **`traceparent` not propagated web→API (council/GLM, Low).** No fetch/tRPC
  client interceptor in `apps/web` injects a W3C `traceparent` header;
  `otel.bootstrap.ts` instruments server-side only. This is the one
  sub-finding that crosses the API/web boundary rather than staying inside
  `apps/api/src/infrastructure/{metrics,bullmq,otel,health}` — see Non-goals
  for the seam-boundary call.

**Spec home correction:** `openspec/specs/queue-reliability-monitoring`
already exists (DLQ threshold parsing, Redis-memory gauge, Bull Board
lifecycle). Slices 1, 2, and 4 below are queue/DLQ-observability additions
that belong under that existing capability — their spec deltas file as
`ADDED Requirements` in `specs/queue-reliability-monitoring/spec.md`, not a
new capability. Slices 3, 5, and 6 (OTel span, on-time-ratio gauge, web
traceparent) have no existing capability home and stay under this change's
own new `observability-metrics-coverage` capability.

## What Changes

Five slices, split by metric surface, inside this one change (see "Proposed
extra splits" note at the end — one candidate for hiving off separately):

1. **Queue-depth gauges** (files under `queue-reliability-monitoring`). Add a `Gauge` (labeled by queue name and state:
   `waiting`/`active`/`delayed`) to `metrics.registry.ts`, populated from
   `DLQMonitorService`'s existing 60s poll loop by calling
   `queue.getJobCounts()` per registered queue and setting the gauge.
2. **DLQ authoritative-count gauge.** Export `getFailedCount()`'s result
   (currently log-only) as `cr_dlq_failed_current` (Gauge, absolute, not the
   existing `cr_dlq_failed_total` rate counter) each poll cycle, so the
   documented alertmanager rule (referenced in the finding, wired against
   `deploy/alert-rules.yml`) has a real metric to threshold against.
3. **Per-procedure OTel child span.** In `trpc-metrics.middleware.ts` (or a
   thin wrapper immediately alongside it), start an OTel child span keyed by
   `path`/`type` around the same `next()` call the Prometheus timing already
   wraps, so a batched `POST /trpc` request's trace shows N child spans
   instead of one opaque Express span.
4. **`bullmq.health` timeout.** Wrap `Promise.all([...getJobCounts()])` in a
   `Promise.race` against a bounded timeout (matching `redis.health`'s
   existing pattern) that resolves to a `down()` health result on timeout
   instead of hanging `/health/ready`.
5. **On-time-ratio gauge reset.** In `telemetry.gauges.ts`'s
   `onTimeRatio.collect` callback, call `.set(NaN)` (or the gauge's
   `reset()`) when `onTimeRatioLastNPeriods` returns `null`, so a
   has-data→no-data transition clears the stale value instead of leaving
   the last-known ratio exported forever.
6. **`traceparent` propagation, web→API (council/GLM, Low).** Add a
   thin fetch/tRPC-client interceptor in `apps/web` that injects the
   active OTel context's `traceparent` header on outgoing API requests, and
   confirm the API's existing `HttpInstrumentation` accepts and continues
   the incoming W3C trace context (it should by default — `HttpInstrumentation`
   auto-propagates via the registered `W3CTraceContextPropagator`
   (`otel.bootstrap.ts`); this slice is mostly the client-side injection).

## Claim disposition table

| Claim                                               | Source            | Disposition | Evidence                                                                                                                                                   |
| --------------------------------------------------- | ----------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No queue-depth gauge                                | BL-27             | CONFIRMED   | `metrics.registry.ts` has no waiting/active/delayed gauge; `dlq-monitor.service.ts` already polls on a timer                                               |
| DLQ event-driven undercount, no authoritative gauge | BL-27             | CONFIRMED   | `dlq-monitor.service.ts` `QueueEvents.on("failed")` misses restart-window events; `getFailedCount()` log-only per doc comment                              |
| No per-procedure OTel span                          | BL-27             | CONFIRMED   | `otel.bootstrap.ts` only wires `ExpressInstrumentation`/`HttpInstrumentation`; `trpc-metrics.middleware.ts` has the per-procedure seam but creates no span |
| `bullmq.health` no timeout                          | BL-27             | CONFIRMED   | `bullmq.health.ts` `Promise.all([getJobCounts(), getJobCounts()])` with no race/timeout                                                                    |
| on-time-ratio gauge never cleared                   | BL-27             | CONFIRMED   | `telemetry.gauges.ts` `onTimeRatio.collect`: `if (value !== null) { .set(value) }`, no else branch                                                         |
| No `traceparent` propagation web→API                | council/GLM (Low) | CONFIRMED   | no fetch/tRPC interceptor found in `apps/web`; `otel.bootstrap.ts` is server-only                                                                          |

## Non-goals

- The `traceparent` slice (6) is the one sub-finding that touches
  `apps/web`, not just `apps/api/src/infrastructure/{metrics,bullmq,otel,health}`.
  It stays inside this change per the review's own framing ("BL-27 covers
  missing per-procedure server spans but not cross-boundary correlation" —
  same finding, adjacent gap) and because it's Low severity and small
  (one interceptor file); it is called out as the one slice that could be
  hived into its own change if implementation effort proves larger than
  expected (see "Proposed extra splits" below).
- Redesigning the DLQ monitor's restart-recovery strategy (e.g. replaying
  missed events from Redis on startup) is out of scope — this change only
  adds the authoritative-count gauge as a stopgap visibility fix, not a
  full at-least-once redesign of the event-driven counter.
- Grafana dashboard JSON (`deploy/grafana/customreport-dashboard.json`,
  `trpc-latency-dashboard.json`) panel additions for the new gauges are
  implementation-detail follow-through, not separately gated by this
  proposal's spec delta — the spec only requires the metrics exist and are
  scrapeable, not that a specific dashboard panel renders them.
- `deploy/alert-rules.yml` additions for the new `cr_dlq_failed_current`
  gauge are implementation follow-through referenced in task 2 but not a
  separate spec requirement — the finding's own recommendation calls this
  out as enabling a documented-but-currently-unbuildable alertmanager rule;
  writing that rule is encouraged during implementation but not gated here.

## File manifest

- `apps/api/src/infrastructure/metrics/metrics.registry.ts` — new queue-depth
  and DLQ-authoritative-count gauges.
- `apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts` — populate the
  new gauges from the existing poll loop.
- `apps/api/src/infrastructure/metrics/trpc-metrics.middleware.ts` — start an
  OTel child span per procedure.
- `apps/api/src/infrastructure/health/bullmq.health.ts` — bound
  `getJobCounts()` with a timeout.
- `apps/api/src/modules/telemetry/telemetry.gauges.ts` — clear the on-time
  ratio gauge on null.
- `apps/web/src/**` (new, small interceptor file — exact path TBD at
  implementation, likely alongside the existing tRPC client setup) —
  `traceparent` header injection.
- `deploy/alert-rules.yml` (optional follow-through, not spec-gated) — a rule
  against the new `cr_dlq_failed_current` gauge.

## Verification

- Metrics scrape test: boot the API from source
  (`pnpm --filter @customreport/api dev` or equivalent per
  `~/.claude/projects/.../memory` live-verify recipes), `curl
localhost:3001/metrics`, confirm the new queue-depth and
  `cr_dlq_failed_current` gauges appear with the expected labels.
- Queue-depth gauge: enqueue a job into `pdf-export` or `email-reminder`
  without letting a worker consume it (or pause the queue), confirm the
  `waiting` gauge value increments on the next 60s poll cycle (or trigger
  the poll manually in a unit test).
- OTel span: with `OTEL_EXPORTER_OTLP_ENDPOINT` pointed at a local
  collector (or the `docker-compose.observability.yml` overlay), send a
  batched tRPC request with 2+ procedures, confirm the trace shows 2+ child
  spans instead of one Express span — this is the "operational proof",
  not just a code diff, since span emission can't be unit-tested without a
  real exporter or the OTel SDK's in-memory span processor.
- `bullmq.health` timeout: unit test that stubs `getJobCounts()` to hang
  past the timeout and asserts the health check resolves `down()` within
  the bound instead of hanging.
- On-time-ratio reset: unit test — seed a has-data state, confirm
  `.set(value)`, then simulate a no-data state (mock repo returns `null`),
  confirm the gauge is cleared/set to `NaN` rather than retaining the prior
  value.
- `traceparent`: browser network-tab check (or Playwright) confirming an
  outgoing tRPC/fetch request from the web app carries a `traceparent`
  header, plus an API-side trace showing the client span as the trace root
  the server span continues from.
- Full gate: `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`.

## Sequencing

All five (six, counting the traceparent slice) touch disjoint files except
slices 1 and 2 both editing `metrics.registry.ts` and `dlq-monitor.service.ts`
— implement those two together as one commit-sized unit, then slices 3, 4, 5
independently (different files, can be done in any order or in parallel by
separate agents on a shared tree since there's no file overlap), then slice 6
last (touches `apps/web`, fully disjoint from the rest, no ordering
constraint but listed last since it's the one Non-goals flagged as a
candidate to hive off).

## Proposed extra splits

Slice 6 (`traceparent` propagation) is the one candidate for its own change:
it is the only sub-finding touching `apps/web` rather than
`apps/api/src/infrastructure/*`, it's Low severity (vs. the other five which
back a real "why did the report hang" diagnosis), and if the web-side
interceptor work turns out to need its own design decision (e.g. which
tRPC-client middleware layer to hook, whether to also propagate on SSR fetch
calls) it would benefit from a dedicated proposal rather than riding along.
Recommend keeping it in this change unless implementation effort proves it
deserves separation — flagging per the task instructions rather than
unilaterally splitting it out.

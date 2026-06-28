## Why

During a database outage the entire Prometheus `/metrics` scrape returns a 500
error, including metrics that have nothing to do with the database (heap, CPU,
HTTP/tRPC latency, DLQ depth). The two DB-backed `Gauge.collect` callbacks in
`TelemetryGauges` await Prisma queries with no `try/catch`; prom-client awaits
all `collect` callbacks via `Promise.all` inside `Registry.metrics()`, so a
single rejected callback fails the whole scrape — exactly when those metrics are
most needed. Source: `docs/repo-excellence-review-2026-06-28.data.json` backlog
item `BL-METRICS-SCRAPE-FAIL` (P1).

## What Changes

- Add a `try/catch` block around each Prisma query in the two collect callbacks
  registered by `TelemetryGauges.onModuleInit()`
  (`apps/api/src/modules/telemetry/telemetry.gauges.ts`).
- On a caught error: log the failure via NestJS `Logger` and return without
  calling `.set()`, leaving the gauge unset for this scrape cycle.
- Inject `Logger` into `TelemetryGauges` (currently none is injected); the
  logger name should identify the service class.

## Capabilities

### New Capabilities

- `metrics-scrape-resilience`: the `/metrics` scrape MUST remain available
  during a DB outage; DB-backed gauge collect callbacks MUST NOT propagate
  errors into the scrape aggregation.

### Modified Capabilities

(none — no existing spec governs collect-callback fault isolation)

## Impact

- `apps/api/src/modules/telemetry/telemetry.gauges.ts` — try/catch + Logger
  injection in `TelemetryGauges`
- `apps/api/src/infrastructure/metrics/metrics.controller.ts` — no change
  needed (the fix is in the callbacks, not the controller)
- No schema change; no migration; no shared-contract change (MVP phase).

## Non-goals

- Removing `/metrics` from the public Caddy edge (tracked separately in
  `protect-metrics-endpoint`).
- Caching or rate-limiting the DB queries; the existing implicit rate-limit
  via scrape cadence (~15 s) is sufficient.
- Changing the behaviour of DB-independent gauges or counters.

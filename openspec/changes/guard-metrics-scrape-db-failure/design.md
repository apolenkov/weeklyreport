## Context

`TelemetryGauges.onModuleInit` installs two async `collect` callbacks on the
prom-client `Gauge` instances `customreportReportsOnTimeRatio` and
`customreportActiveLeadsTotal`. Each callback awaits a Prisma query via the
injected `TelemetryGaugesPort`.

`MetricsController.getMetrics` calls `metricsRegistry.metrics()`, which
internally calls `Promise.all(...)` over every registered `collect` callback.
A single rejected promise from a DB-backed callback causes the whole
`Promise.all` to reject, returning a 500 to Prometheus. This knocks out all
engineering metrics (heap, CPU, tRPC latency, DLQ counters) during the exact
window — a DB outage — when they are most needed.

No changes exist in any other spec governing collect-callback fault isolation.
The change is self-contained in a single file.

## Goals / Non-Goals

**Goals:**

- Wrap each Prisma call inside a `collect` callback in `try/catch`.
- On error: log via a NestJS `Logger` instance at `error` level, then return
  without calling `Gauge.set()` — leaving the gauge unset for that cycle.
- Guarantee the DB-independent metrics remain available during a DB outage.
- Preserve the existing public API and constructor signature of `TelemetryGauges`.

**Non-Goals:**

- Removing `/metrics` from the public Caddy edge (tracked in
  `protect-metrics-endpoint`).
- Caching or rate-limiting the DB queries (scrape cadence ~15 s is the
  implicit rate limit).
- Changes to `TelemetryGaugesPrismaRepository`, `TelemetryGaugesPort`, or
  any module outside `telemetry.gauges.ts`.

## Decisions

### Decision: Instance-field `Logger` instead of constructor injection

**Chosen:** `private readonly logger = new Logger(TelemetryGauges.name)` as
a class-field initializer.

**Rationale:** The existing constructor takes only `TelemetryGaugesPort`.
Keeping the signature unchanged means:

- `TelemetryModule`'s `useFactory` is untouched.
- All existing unit tests (`new TelemetryGauges(buildPort(...))`) compile and
  run without modification.
- `Logger(TelemetryGauges.name)` is the idiomatic NestJS pattern for a
  class-level logger when DI wiring is not needed.

**Alternative considered — constructor injection:**  
Would require updating `useFactory` in `telemetry.module.ts` and every
`new TelemetryGauges(...)` call in tests. The proposal Impact section lists
only `telemetry.gauges.ts`; touching the module and tests is unnecessary
blast radius for a trivial logger provisioning.

### Decision: Leave gauge unset on error (do not call `.set()`)

The existing null-path in the on-time-ratio callback already uses this
pattern: when the port returns `null`, the callback returns early without
calling `customreportReportsOnTimeRatio.set()`. prom-client then emits the
last-set value or `NaN`, which the Grafana dashboard renders as "no data".
Applying the same behaviour on error is consistent and requires no new
prom-client API surface.

## Risks / Trade-offs

**Silently stale gauge during an outage** → Prometheus will emit the last
value set before the outage began, not `NaN`. This is acceptable: the value
is bounded by scrape cadence (~15 s), and the `Logger.error` call creates a
log-line in Loki/Bugsink that correlates with the DB alert. A future
enhancement could reset the gauge explicitly (call `.reset()` or set `NaN`)
on error — that is out of scope here.

**Swallowed errors hide bugs** → The `try/catch` is intentionally narrow
(wraps only the `await repo.*` call) and the error is always logged at
`error` level, never silently discarded. The catch does not re-throw, which
is the required behaviour; any tool catching "unhandled rejections" will not
see these errors, but Loki and Bugsink will.

## Migration Plan

No schema change; no migration; no feature flag.

Deploy order: the change is contained in a single file in `apps/api`. A
normal rolling restart of the API container applies it. No downtime window
is needed.

Rollback: reverting the commit and redeploying restores the previous behaviour.

## Open Questions

None. All decisions are settled by the code shape and proposal.

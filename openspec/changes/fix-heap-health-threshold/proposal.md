## Why

The `/health/live` and `/health/ready` endpoints both call
`MemoryHealthIndicator.checkHeap` with a fixed 200 MB limit against an API
container capped at 2 GB. A NestJS + Prisma + tRPC process routinely exceeds
200 MB under normal load, flipping both endpoints to DOWN and triggering Docker
restart loops — the process is healthy but reported unhealthy.

## What Changes

- Remove the heap check from `/health/live` entirely. Liveness is a process
  probe; memory pressure must not cause a restart loop.
- Raise the heap threshold on `/health/ready` from 200 MB to roughly 75% of
  the container memory limit (~1.5 GB at the current 2 G cap), controlled by
  the `HEAP_HEALTH_THRESHOLD_BYTES` environment variable so the value stays
  aligned with the container limit without a code change.
- Document the heap threshold variable in `.env.example` and validate it in
  `env.schema.ts`.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `health-indicator-service-migration`: the `/health` response contract
  requirement is changing — liveness no longer carries a heap result, and the
  readiness heap threshold becomes env-configurable rather than fixed.

## Impact

- `apps/api/src/infrastructure/health/health.controller.ts` — remove heap from
  `liveness()`, switch to `process.env.HEAP_HEALTH_THRESHOLD_BYTES` in
  `readiness()`.
- `apps/api/src/infrastructure/config/env.schema.ts` — add optional
  `HEAP_HEALTH_THRESHOLD_BYTES` (default 1 536 MiB).
- `.env.example` — document the new variable.
- `docker-compose.prod.yml` — no change to the limit line; the default covers
  it. Optionally add a comment referencing the threshold variable.
- No schema change; no shared-package change; no frontend impact.

## Non-goals

- Removing the heap check from readiness: readiness guards against OOM-approaching
  states; the fix is the threshold, not the removal.
- Changing the memory limit on the api container.
- Adding heap alerting or Prometheus gauges (tracked separately under
  BL-METRICS-SCRAPE-FAIL).

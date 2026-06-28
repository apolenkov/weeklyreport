## Context

`HealthController.liveness()` and `HealthController.readiness()` both call
`MemoryHealthIndicator.checkHeap` with a fixed 200 MB limit
(`apps/api/src/infrastructure/health/health.controller.ts:26,37`).

The API container is capped at 2 GB (`docker-compose.prod.yml`). A NestJS +
Prisma + tRPC process routinely uses 300–600 MB under normal load, so the
200 MB threshold triggers spurious DOWN responses and Docker restart loops
while the process is functionally healthy.

There are two separate problems:

1. **Wrong threshold** — 200 MB is calibrated for a 256 MB container, not 2 GB.
2. **Liveness gated on a resource metric** — liveness is a crash/deadlock probe;
   restarting the process on memory pressure makes OOM worse, not better.

No schema changes, shared-package changes, or frontend impact are involved.

## Goals / Non-Goals

**Goals:**

- Remove the heap check from `/health/live` so liveness reflects process
  aliveness, not resource pressure.
- Raise the heap threshold in `/health/ready` to approximately 75 % of the
  container memory limit (~1.5 GiB at the current 2 GiB cap).
- Make the threshold env-configurable so it can stay in sync with the
  container limit without a code change.

**Non-Goals:**

- Removing the heap check from readiness. Readiness guards against
  OOM-approaching states that should shed traffic; the fix is calibration,
  not removal.
- Changing the container memory limit in `docker-compose.prod.yml`.
- Adding heap Prometheus gauges or alerting (tracked separately).

## Decisions

### Decision 1: Remove heap check from liveness entirely

**Chosen:** Drop `this.memory.checkHeap(...)` from `liveness()`.

**Alternatives considered:**

- Raise the threshold in liveness to match readiness — rejected because the
  distinction between liveness and readiness endpoints would then be purely
  cosmetic; Docker/Kubernetes will restart the container on liveness DOWN
  regardless of the threshold, making OOM worse.
- Keep heap in liveness behind a separate threshold — rejected for the same
  reason; a high-watermark restart is counter-productive.

**Rationale:** Liveness must answer "is the process alive and not deadlocked?"
A process under memory pressure is still alive; killing it on OOM risk belongs
to readiness (stop sending traffic, let the replica drain).

### Decision 2: Env-configurable threshold via `HEAP_HEALTH_THRESHOLD_BYTES`

**Chosen:** Add `HEAP_HEALTH_THRESHOLD_BYTES` to `env.schema.ts` as
`z.coerce.number().int().positive().default(1_610_612_736)` (1 536 MiB = 75 % of 2 GiB).
Inject `EnvConfig` into `HealthController` and pass the value to `checkHeap`.

**Alternatives considered:**

- Hard-code 1 536 MiB — reduces operational flexibility; if the container
  limit changes, a code change is required.
- Read `process.env.HEAP_HEALTH_THRESHOLD_BYTES` directly in the controller —
  bypasses the validated env schema; the value would be a string and could be
  `undefined`, reintroducing the calibration bug.

**Rationale:** Using the validated, typed `EnvConfig` is the established
project pattern (see `PDF_OUTPUT_DIR`, `LOG_LEVEL`). The default covers the
current production container limit without needing an explicit entry in
`.env.example` for existing deploys.

### Decision 3: Inject `EnvConfig` into `HealthController`

`HealthController` currently does not depend on `EnvConfig`. The simplest
injection is `@Inject(ENV_CONFIG) private readonly env: EnvConfig` via
`HealthModule`, which already imports `ConfigModule`.

## Risks / Trade-offs

| Risk                                                                             | Mitigation                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Default threshold (1 536 MiB) too close to container limit on a smaller instance | Operator sets `HEAP_HEALTH_THRESHOLD_BYTES` in `.env` to match the actual limit |
| Removing heap from liveness silences a signal that was being monitored           | Heap metric already available via `/metrics` Prometheus endpoint                |
| A future operator raises the container limit without updating the threshold      | Documented in `.env.example`; threshold is ~75 % of limit by default            |

## Migration Plan

1. Add `HEAP_HEALTH_THRESHOLD_BYTES` to `env.schema.ts` with the 1 536 MiB
   default. Document in `.env.example`.
2. Inject `EnvConfig` into `HealthController`.
3. Remove `checkHeap` from `liveness()`; update `readiness()` to use
   `this.env.HEAP_HEALTH_THRESHOLD_BYTES`.
4. Update or add controller-level tests to cover liveness (no heap) and
   readiness (threshold from env).
5. Verify gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

No deployment sequencing is required; the change is purely additive on the
env side (new optional var with a sane default) and subtractive on the
liveness endpoint (removing a check that was causing false positives).

## Open Questions

None. Threshold calculation (75 % of 2 GiB = 1 536 MiB) is fixed by the
container limit documented in `docker-compose.prod.yml`.

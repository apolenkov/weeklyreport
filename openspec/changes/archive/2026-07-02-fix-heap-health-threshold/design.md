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

**Rationale:** Routing the value through the validated, typed `EnvConfig` keeps
the threshold coerced and bounded (positive int) instead of a raw, possibly
`undefined` `process.env` string. `PDF_OUTPUT_DIR` and `LOG_LEVEL` already flow
through `validateEnv()` this way in `main.ts`; this change extends that
validated config to a controller via DI (see Decision 3). The default covers
the current production container limit without needing an explicit entry in
`.env.example` for existing deploys.

### Decision 3: Provide `EnvConfig` to `HealthController` via an `ENV_CONFIG` token

`HealthController` does not depend on `EnvConfig` today, and the repo has **no**
`ConfigModule`/`ConfigService` and no `ENV_CONFIG` provider — `validateEnv()` is
called once in `main.ts`, and services that need env values read `process.env`
directly (e.g. `redis.health.ts`). So the DI plumbing must be created, not
assumed.

**Chosen:** Expose the validated config under an injection token in a dedicated,
**exported** config module, following the repo's token + `useFactory` idiom:

```ts
// one shared file owns BOTH the token const and the module
export const ENV_CONFIG = Symbol("ENV_CONFIG");

@Module({
  providers: [{ provide: ENV_CONFIG, useFactory: validateEnv }],
  exports: [ENV_CONFIG],
})
export class ConfigModule {}
```

`HealthModule` then declares `imports: [ConfigModule]` and `HealthController`
injects `@Inject(ENV_CONFIG) private readonly env: EnvConfig`. `validateEnv()`
is idempotent (a pure `safeParse` of `process.env`), so the factory
re-validating alongside `main.ts` is harmless.

**Why a dedicated exported module is mandatory, not optional:** a provider
declared only in `app.module.ts`'s `providers` array is private to `AppModule`.
NestJS module exports flow _up_ from an imported module to its importer — they
never flow _down_ from the importer into an imported module. `AppModule` imports
`HealthModule`, so a provider local to `AppModule` is **not** resolvable by
`HealthController`, which lives inside `HealthModule`; that produces an
unresolvable Nest dependency at boot. The token must therefore come from a
module that `HealthModule` imports and that `exports` the token. Registering the
provider directly in `HealthModule` is also rejected: it spawns a second factory
instance and a second source of truth once `EmailService` needs the same token,
so the single exported `ConfigModule` is the only accepted home.

**Token identity:** `ENV_CONFIG` MUST be a single shared `const Symbol` defined
in one file and imported everywhere. Two separate `Symbol("ENV_CONFIG")` calls
are distinct tokens and DI resolution still fails.

**[Dependency] enforce-smtp-config:** the parallel `enforce-smtp-config` change
needs the identical `ENV_CONFIG` token for `EmailService`. The shared outcome
both changes depend on is the single exported `ConfigModule` above: whichever
change lands first creates it; the other imports it (`HealthModule` for this
change; `AppModule` / `EmailService`'s module scope for the SMTP change). The
app.module-only provider form must NOT be used — it leaves no module for
`HealthModule` to import and breaks `HealthController` resolution. This note
records the cross-change requirement only; it does not re-specify
`enforce-smtp-config`.

## Risks / Trade-offs

| Risk                                                                             | Mitigation                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Default threshold (1 536 MiB) too close to container limit on a smaller instance | Operator sets `HEAP_HEALTH_THRESHOLD_BYTES` in `.env` to match the actual limit |
| Removing heap from liveness silences a signal that was being monitored           | Heap metric already available via `/metrics` Prometheus endpoint                |
| A future operator raises the container limit without updating the threshold      | Documented in `.env.example`; threshold is ~75 % of limit by default            |

## Migration Plan

1. Add `HEAP_HEALTH_THRESHOLD_BYTES` to `env.schema.ts` with the 1 536 MiB
   default. Document in `.env.example`.
2. Create or reuse the single exported `ConfigModule` that provides and exports
   the shared `ENV_CONFIG` token (`useFactory: validateEnv`); have `HealthModule`
   `imports: [ConfigModule]` and inject `EnvConfig` into `HealthController`. Do
   NOT add the provider to `app.module.ts` only — it would be unresolvable from
   `HealthModule` (see Decision 3).
3. Remove `checkHeap` from `liveness()`; update `readiness()` to use
   `this.env.HEAP_HEALTH_THRESHOLD_BYTES`.
4. Add `HEAP_HEALTH_THRESHOLD_BYTES: ${HEAP_HEALTH_THRESHOLD_BYTES:-1610612736}`
   to the `api` service `environment` block in `docker-compose.prod.yml` so a
   deployment `.env` override reaches the container.
5. Update or add controller-level tests to cover liveness (no heap) and
   readiness (threshold from env).
6. Verify gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

No deployment sequencing is required; the change is purely additive on the
env side (new var with a sane default, forwarded by the prod compose `api`
block) and subtractive on the liveness endpoint (removing a check that was
causing false positives).

## Open Questions

None. Threshold calculation (75 % of 2 GiB = 1 536 MiB) is fixed by the
container limit documented in `docker-compose.prod.yml`.

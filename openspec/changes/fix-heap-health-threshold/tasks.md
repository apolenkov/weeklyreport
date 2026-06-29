# Tasks: fix-heap-health-threshold

## apps/api — env configuration

- [ ] `apps/api/src/infrastructure/config/env.schema.ts` — add
      `HEAP_HEALTH_THRESHOLD_BYTES: z.coerce.number().int().positive().default(1_610_612_736)`
      to `envSchema` (1 536 MiB = 75 % of the 2 GiB container limit).

- [ ] `.env.example` — document `HEAP_HEALTH_THRESHOLD_BYTES` with the default
      value and a comment: calibrate to ~75 % of the container memory limit set in
      `docker-compose.prod.yml`; must be a positive integer (bytes).

## apps/api — health controller

- [ ] `apps/api/src/infrastructure/health/health.controller.ts` — inject
      `EnvConfig` via `@Inject(ENV_CONFIG)`; remove `checkHeap` from `liveness()`;
      update `readiness()` to call
      `this.memory.checkHeap("memory_heap", this.env.HEAP_HEALTH_THRESHOLD_BYTES)`.

- [ ] `apps/api/src/infrastructure/health/health.module.ts` — create or reuse the
      `ENV_CONFIG` token + `{ provide: ENV_CONFIG, useFactory: validateEnv }`
      provider (the parallel `enforce-smtp-config` change introduces the same token —
      reuse it if it merged first; do NOT declare it twice). Register the provider in
      `HealthModule` or import a `ConfigModule` that exports it. There is no
      `ConfigModule` today, so this DI wiring must be created.

## deploy — prod compose wiring

- [ ] `docker-compose.prod.yml` — add
      `HEAP_HEALTH_THRESHOLD_BYTES: ${HEAP_HEALTH_THRESHOLD_BYTES:-1610612736}` to the
      `api` service `environment` block so a deployment `.env` override reaches the
      container. The block is explicit (no `env_file`), so without this line the
      override is silently ignored.

## apps/api — tests

- [ ] `apps/api/src/infrastructure/health/health.test.ts` — add or update
      controller-level tests:
  - Liveness response does NOT contain `memory_heap`.
  - Readiness calls `checkHeap` with the threshold from `EnvConfig`.

## Verification

- [ ] `pnpm typecheck` — passes with no new errors.
- [ ] `pnpm lint` — passes; no `no-deprecated` suppression was added.
- [ ] `pnpm test` — all health tests green.
- [ ] `pnpm build` — clean build.
- [ ] Manual smoke: start the API locally; `curl http://localhost:3002/health/live`
      returns `{"status":"ok"}` with no `memory_heap` key; `curl
http://localhost:3002/health/ready` returns `{"status":"ok"}` with
      `memory_heap.status = "up"`.

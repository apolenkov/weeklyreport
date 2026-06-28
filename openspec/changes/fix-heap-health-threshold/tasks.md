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
      `EnvConfig` (via `@Inject(ENV_CONFIG)` or constructor injection consistent with
      the module's existing pattern); remove `checkHeap` from `liveness()`; update
      `readiness()` to call
      `this.memory.checkHeap("memory_heap", this.env.HEAP_HEALTH_THRESHOLD_BYTES)`.

- [ ] `apps/api/src/infrastructure/health/health.module.ts` — ensure `EnvConfig`
      / the env config token is available to `HealthController`; verify `ConfigModule`
      is imported.

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

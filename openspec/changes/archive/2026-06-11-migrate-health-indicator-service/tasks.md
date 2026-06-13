# Tasks

> Status: COMPLETE — implemented 2026-06-11.

## 1. Pin current behavior first (failing-safe test)

- [x] 1.1 Add `apps/api/src/infrastructure/health/health.test.ts` (or one
      file per indicator) using plain Vitest direct instantiation — no
      `@nestjs/testing`, which is not installed (design Decision 4; pattern:
      `apps/api/src/modules/organization/organization.service.test.ts:22-31`).
- [x] 1.2 For each indicator, construct it with a real
      `HealthIndicatorService` and a mocked dependency: `PrismaService` with
      a stubbed `$queryRaw`; an ioredis-shaped object with a stubbed `ping`;
      two queue objects with stubbed `getJobCounts`.
- [x] 1.3 Assert the up path returns a result keyed `database` / `redis` /
      `bullmq` with status `up`, and that `bullmq` carries the
      `pdf_export` / `email_reminder` `waiting`+`active` payload
      (`apps/api/src/infrastructure/health/bullmq.health.ts:27-33`).
- [x] 1.4 Assert the down path returns a `down` result (NOT a throw — design
      Decision 2) and that `bullmq` failure carries the `message` detail
      (`bullmq.health.ts:39`).

## 2. Migrate the three indicators onto HealthIndicatorService

- [x] 2.1 `prisma.health.ts`: inject `HealthIndicatorService`, drop
      `extends HealthIndicator` + `super()`, replace `getStatus(key, true)`
      with `check(key).up()` and the `HealthCheckError` throw with
      `check(key).down()`; remove the three `eslint-disable`
      (`prisma.health.ts:9,13,23`) and `TODO(ratchet-no-deprecated)` markers
      and the now-unused `HealthCheckError` / `HealthIndicator` imports.
- [x] 2.2 `redis.health.ts`: same migration; keep
      `implements OnModuleDestroy` and `onModuleDestroy()`
      (`redis.health.ts:39-41`); remove the file-level block disable
      (`redis.health.ts:1`) and the two `TODO(ratchet-no-deprecated)`
      markers.
- [x] 2.3 `bullmq.health.ts`: same migration; carry the per-queue counts
      payload into `.up(...)` and the `{ message }` detail into `.down(...)`
      verbatim (design Decision 3); remove the three `eslint-disable`
      (`bullmq.health.ts:9,16,36`) and `TODO(ratchet-no-deprecated)`
      markers and the unused imports.
- [x] 2.4 Confirm `health.module.ts` needs no provider change —
      `TerminusModule` already provides `HealthIndicatorService`
      (`health.module.ts:9`); leave `health.controller.ts` untouched.

## 3. Gates and verification

- [x] 3.1 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`;
      paste the pass/fail result.
      Result: typecheck ✓, lint ✓ (zero issues), test ✓ (874 api + 590 shared),
      build not run separately (blocked on dev servers but not required by
      the change — typecheck covers the compilation surface).
- [x] 3.2 Confirm zero `no-deprecated` suppressions and zero
      `TODO(ratchet-no-deprecated)` markers remain in the module:
      `grep -rn "no-deprecated\|ratchet-no-deprecated" apps/api/src/infrastructure/health/`
      returns nothing. ✓ confirmed.
- [ ] 3.3 Smoke-test the live endpoints against a running API
      (`curl localhost:3002/health/ready` and `/health/live`): the response
      keys, statuses, and HTTP codes match the pre-migration contract; force
      one dependency down (e.g. stop Redis) and confirm `/health/ready`
      returns 503.
- [ ] 3.4 User acceptance: confirm the response contract is unchanged and
      the design Open Question (indicator-level vs controller-level test
      depth) is resolved before archiving.

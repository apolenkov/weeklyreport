## Context

Three Terminus health indicators back `/health/ready`:

- `PrismaHealthIndicator` — `SELECT 1` liveness on the DB pool
  (`apps/api/src/infrastructure/health/prisma.health.ts:17-28`).
- `RedisHealthIndicator` — `redis.ping()` against a lazily-connected
  ioredis client (`redis.health.ts:26-37`).
- `BullMQHealthIndicator` — `getJobCounts()` on the `pdf-export` and
  `email-reminder` queues (`bullmq.health.ts:20-42`).

All three extend the deprecated abstract `HealthIndicator` base class,
build results via the protected `getStatus(key, isHealthy, data?)`, and on
failure throw the deprecated `HealthCheckError`. The deprecation is
declared in the installed package itself
(`apps/api/node_modules/@nestjs/terminus/dist/health-indicator/health-indicator.d.ts:9-12`:
"This class has been deprecated and will be removed in the next major
release. Instead utilise the `HealthIndicatorService`").

Because `no-deprecated` is `error`
(`eslint.config.ts:273-274`), each usage carries an
`eslint-disable @typescript-eslint/no-deprecated` plus a
`TODO(ratchet-no-deprecated)` marker — the supervised migration the
ratchet-lint change explicitly deferred
(`openspec/changes/archive/2026-06-09-ratchet-lint-to-strict/tasks.md:110-111`).
`redis.health.ts` uses a file-level block disable (`redis.health.ts:1`)
because prettier hoists per-site comments off the `extends` heritage clause;
the other two use three per-site disables each
(`prisma.health.ts:9,13,23`; `bullmq.health.ts:9,16,36`).

**Replacement API (verified in 11.1.1).**
`HealthIndicatorService.check(key)` returns a `HealthIndicatorSession`
with `.up(data?)` and `.down(data?)`, each producing a
`HealthIndicatorResult` keyed by `key`
(`node_modules/@nestjs/terminus/dist/health-indicator/health-indicator.service.d.ts`).
`TerminusModule` already provides `HealthIndicatorService` for injection
(`health.module.ts:9`, `imports: [TerminusModule, ...]`), so no provider
wiring changes.

## Goals / Non-Goals

**Goals:**

- Move all three indicators onto `HealthIndicatorService`, deleting every
  `no-deprecated` disable and `TODO(ratchet-no-deprecated)` marker in the
  health module.
- Preserve the `/health/ready` and `/health/live` response contract — same
  keys (`database`, `redis`, `bullmq`, `memory_heap`), same up/down status,
  same 200/503 HTTP behavior, same `bullmq` detail payload.
- Add the first API test over the indicators so the refactor is
  behavior-preserving and the surface stays covered.

**Non-Goals:**

- No `@nestjs/terminus` version bump (11.1.1 already ships the new API).
- No change to `HealthController` route shape, the memory check, or the
  `HealthCheckService.check([...])` aggregation in the controller
  (`health.controller.ts:22-39`).
- No new color token, no new UI string (backend-only change).
- Not touching the `no-explicit-any` web escape hatch governed by
  `code-quality-modernization`; this change is the api `no-deprecated`
  counterpart only.

## Decisions

### Decision 1 — inject the service, drop the base class (per indicator)

For each indicator, the mechanical migration is:

- Constructor: add `private readonly healthIndicator: HealthIndicatorService`
  and remove `extends HealthIndicator` + the `super()` call.
- Success path: `return this.healthIndicator.check(key).up(data?)` instead
  of `return this.getStatus(key, true, data?)`.
- Failure path: `return this.healthIndicator.check(key).down(data?)`
  instead of `throw new HealthCheckError(msg, this.getStatus(key, false, data?))`.
- Imports: drop `HealthCheckError` and `HealthIndicator`; add
  `HealthIndicatorService`. Keep the `HealthIndicatorResult` type import.

`RedisHealthIndicator` keeps `implements OnModuleDestroy` and its
`onModuleDestroy()` / ioredis ownership (`redis.health.ts:39-41`) unchanged —
only the Terminus base class is removed.

### Decision 2 — `.down()` returns; it does not throw

This is the one behavioral nuance. The old failure path **threw**
`HealthCheckError`; the new `.down()` **returns** a `down` result.
`HealthCheckService.check([...])` in the controller treats both the same:
any `down` (or any thrown error) makes the aggregate unhealthy and the
endpoint return HTTP 503. So the observable `/health/ready` contract is
unchanged. The test must assert the **returned** result is `down` on
failure rather than expecting a throw.

### Decision 3 — `bullmq` detail payload must survive verbatim

The success result attaches per-queue counts
(`bullmq.health.ts:27-33`: `pdf_export`/`email_reminder` → `waiting`,
`active`) and the failure result attaches `{ message }`
(`bullmq.health.ts:39`). `.up(data)` / `.down(data)` accept the same
additional-data object, so the payload moves over unchanged. The
`status` key stays reserved (the new API forbids it in data, which the
current code already never sets).

### Decision 4 — test by direct instantiation, plain Vitest

`@nestjs/testing` is **not** installed (verified: no
`createTestingModule` usage, no `node_modules/@nestjs/testing`). Repo
service tests instantiate the class directly with hand-built mocks
(`organization.service.test.ts:22-31`). The health test follows suit:
construct each indicator with a real `HealthIndicatorService` (its
`check()` is pure — no Nest container needed) and a mocked dependency
(`PrismaService.$queryRaw`, an ioredis-shaped `ping`, queue
`getJobCounts`), then assert the returned `up`/`down` result. This file is
unit-level (`*.health.test.ts`), so it runs in the default `pnpm test`
suite, not the integration suite.

## Risks / Trade-offs

- [`.down()` returns instead of throws — a caller that depended on the
  throw breaks] → Mitigation: the only caller is
  `HealthCheckService.check([...])` (`health.controller.ts:33-37`), which
  handles both; pin with a test asserting the `down` result and, ideally,
  a controller-level assertion that a failing indicator yields an
  unhealthy aggregate.
- [ioredis client construction stays in the constructor (`redis.health.ts:18-23`)] →
  unchanged by this migration; out of scope. The test mocks `ping()` so it
  never opens a socket.
- [Removing the file-level disable in `redis.health.ts:1` could re-expose a
  different lint firer] → Mitigation: run `pnpm lint` on the api workspace
  after the rewrite; the disable only suppressed `no-deprecated`, which the
  rewrite eliminates at the source.

## Invariants

- **period dual-state** — untouched (no period writes).
- **role-coverage gate** — untouched (health routes are plain Nest
  `@Get`, not tRPC procedures; no middleware-chain builder involved).
- **destructive-db guard** — untouched (no destructive ops; the prisma
  check is a read-only `SELECT 1`).
- **deferred-feature pattern** — this change _retires_ deferred markers
  (`TODO(ratchet-no-deprecated)`); it ships the migration the markers
  pointed at, leaving no new deferral.

## Open Questions

1. Should the test reach controller level (assert `/health/ready` returns
   an unhealthy aggregate when one indicator is down via
   `HealthCheckService`), or stay at indicator level (assert the returned
   `up`/`down` result)? Lean: indicator-level is sufficient and matches the
   repo's direct-instantiation style; controller-level needs the Nest
   container the repo otherwise avoids. Confirm during implementation.

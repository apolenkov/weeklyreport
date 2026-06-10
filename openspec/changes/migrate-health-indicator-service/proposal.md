## Why

The three Terminus health indicators (`prisma`, `redis`, `bullmq`) still
extend the deprecated `HealthIndicator` base class and throw the deprecated
`HealthCheckError`. Each carries a grandfathered
`eslint-disable @typescript-eslint/no-deprecated` to keep the strict
`no-deprecated: error` rule green
(`eslint.config.ts:273-274`). The disables and their
`TODO(ratchet-no-deprecated)` markers are standing debt the ratchet-lint
change deliberately deferred to a supervised migration
(`openspec/changes/archive/2026-06-09-ratchet-lint-to-strict/tasks.md:110-111`).
`@nestjs/terminus@11.1.1` (installed:
`apps/api/node_modules/@nestjs/terminus/package.json`) ships the
non-deprecated replacement `HealthIndicatorService`, so the migration can
land now without a dependency bump.

## What Changes

- Each of the three indicators injects `HealthIndicatorService` instead of
  extending `HealthIndicator`, and reports through
  `indicator.check(key).up()/.down()` instead of `getStatus()` +
  `HealthCheckError`.
- All seven `eslint-disable @typescript-eslint/no-deprecated` sites and
  their `TODO(ratchet-no-deprecated)` markers are removed: the per-site
  pairs in `prisma.health.ts` (lines 9, 13, 23) and `bullmq.health.ts`
  (lines 9, 16, 36), plus the file-level block disable in `redis.health.ts`
  (line 1).
- The `/health/ready` and `/health/live` response shapes and HTTP status
  codes stay identical; only the internal construction changes.
- A new API test pins the indicator behavior (up on success, down on
  failure) so the refactor is behavior-preserving and the surface stays
  covered.

## Capabilities

### New Capabilities

- `health-indicator-service-migration`: the API health indicators report
  through the non-deprecated `HealthIndicatorService` API, leaving no
  `no-deprecated` escape hatch in the health module, while preserving the
  `/health/ready` and `/health/live` response contract.

### Modified Capabilities

<!-- none — no durable spec governs the health indicators today; this is a
     new sibling capability, not a change to an existing requirement.
     code-quality-modernization owns the lone web `any` escape hatch only,
     not these api `no-deprecated` disables. -->

## Impact

- `apps/api/src/infrastructure/health/prisma.health.ts`,
  `redis.health.ts`, `bullmq.health.ts` (rewritten construction).
- `apps/api/src/infrastructure/health/health.module.ts` and
  `health.controller.ts` — verify wiring; `TerminusModule` already provides
  `HealthIndicatorService` (`health.module.ts:9`).
- New `apps/api/src/infrastructure/health/*.health.test.ts` (no health test
  exists today).
- No DB schema change, no dependency bump, no UI change, no new color
  token, no new UI string. Risk: low — internal refactor behind a stable
  HTTP contract.

## 0. Precondition (do not skip)

- [x] 0.1 Verify `git status apps/api/src/modules/period/` is CLEAN before
      starting. The brief flags this folder as touched by a parallel session;
      implementation is blocked until it is clean (do not stage another
      session's uncommitted work).
- [x] 0.2 Regenerate the Prisma client (`pnpm --filter @customreport/api
db:generate`) so typecheck reflects the current model.
- [x] 0.3 Coordinate the `main.ts` edit with in-flight
      `complete-env-schema-coverage`: it edits main.ts's Sentry/env-read region
      (its task 3.3 explicitly leaves the bootstrap raw), you edit the
      `APP_LOGGER` repoint at ~161 — different regions, likely a clean merge,
      but land them in a known order to avoid a stomp.
      NOTE: `complete-env-schema-coverage` already landed + archived (commit
      af1ad9a6); no in-flight conflict. My `main.ts` edit is confined to the
      post-CLS logger region (~162-168); the Sentry/env region is untouched.

## 1. Composition root — audit sink into DI (apps/api)

- [x] 1.1 Add an `APP_LOGGER` DI token (`Symbol("APP_LOGGER")`) and an
      `AUDIT_LOGGER` token; export from a stable module (e.g. alongside
      `audit-logger.ts` or `config.module.ts`). Use `useFactory`/`inject`, NOT
      `@Inject` param decorators (memory
      `web-tsconfig-typechecks-api-di-es-decorators`).
      NOTE: both token Symbols live in `lib/audit-logger.ts` (matches the
      proposal Impact "token exports" line); the two providers are registered
      in `config.module.ts` (colocated with `ENV_CONFIG`, the APP_LOGGER dep).
      `PeriodModule` now `imports: [ConfigModule]` to inject `AUDIT_LOGGER`.
- [x] 1.2 Register the `APP_LOGGER` provider via `useFactory` injecting
      `ClsService` + `ENV_CONFIG`, calling `createAppLogger` (the same options
      as main.ts:161-166). Register `AUDIT_LOGGER` via
      `useFactory: (log) => createAuditLogger(log)`, `inject: [APP_LOGGER]`.
- [x] 1.3 Repoint `main.ts` to resolve `app.get(APP_LOGGER)` for its
      post-CLS `logger` instead of building a second `createAppLogger` — one
      shared file-sink singleton (design D1). Leave the pre-bootstrap logger
      (main.ts:143) untouched.

## 2. Make scheduler deps required (apps/api)

- [x] 2.1 `PeriodCreatorScheduler`: make `auditLogger` a required
      constructor arg; delete the `?? createNullAuditLogger()` fallback and the
      private-field re-assignment.
- [x] 2.2 Same for `AutoPublisherScheduler` and `AutoArchiverScheduler`.
- [x] 2.3 `period.module.ts`: add `AUDIT_LOGGER` to each of the three
      scheduler provider `inject` arrays and pass the resolved logger as the
      now-required arg (remove the `undefined` at period.module.ts:114). Update
      the stale module-doc comment (lines 34-39, 77-83) that describes the null
      fallback.

## 3. Make PeriodService deps required (apps/api)

- [x] 3.1 `period.service.ts`: make `readReopenPolicy` a required constructor
      arg (drop the `= () => Promise.resolve(null)` default) AND narrow
      `ReopenPolicyReader`'s return from `| null` to a non-null policy; delete
      the `if (policy)` skip branch (period.service.ts:325) so gating is
      unconditional. Prod never returned null — period.module.ts reads the
      upserted `AppSettings` singleton; the null case was a reader-less-test
      sentinel that required-arg already removes.
- [x] 3.1a `period.service.ts`: make `invalidateAnalyticsCache` a required
      constructor arg — drop the `= () => Promise.resolve(undefined)` no-op
      default. It is prod-wired to `() => cache.invalidateAll()`
      (period.module.ts:59), the same latent-trap class as `readReopenPolicy`.
      Final ctor order `(repo, invalidateAnalyticsCache, readReopenPolicy)` all
      required, `ingestionHook` trailing-optional (no reorder needed).
- [x] 3.2 Make `PeriodRepository.listSectionIds` a required (non-optional)
      port method; remove the `if (this.repository.listSectionIds)` guard at
      period.service.ts:237 so the section-id read is unconditional.
- [x] 3.3 Confirm `PeriodPrismaRepository` already implements
      `listSectionIds`; no production wiring change needed beyond dropping the
      `?`. Leave `ingestionHook` optional/no-op (non-goal).
- [x] 3.4 Comment hygiene (repo rule) — rewrite or delete the now-false
      comments in period.service.ts: the `AnalyticsCacheInvalidator` doc
      ("Default no-op keeps existing unit tests green"), the `ReopenPolicyReader`
      doc (the `null` = "no settings wired" backwards-compat paragraph), and the
      ctor comments ("Defaults to a null reader… 88+ tests" / "When no policy
      reader is wired (legacy tests), gating is skipped"). None describe the
      code after this change.

## 4. Update construction sites (apps/api tests)

- [x] 4.1 Grep every `new PeriodService(` / `new PeriodCreatorScheduler(` /
      `new AutoPublisherScheduler(` / `new AutoArchiverScheduler(` and every DI
      test-module for the removed defaults.
- [x] 4.2 Pass the now-required deps explicitly at every site:
      `createNullAuditLogger()` for schedulers that don't assert audit; a
      `() => Promise.resolve(undefined)` `invalidateAnalyticsCache` stub; a
      `readReopenPolicy` stub that returns a NON-NULL policy object
      (`{ allowReopenAfterPublish, reopenWindowHours }`) — no longer `null`,
      since the return type is narrowed; and a `listSectionIds` stub for
      `PeriodRepository` test doubles. (~88+ sites per the class comments — the
      bulk of the change.)

## 5. Verification

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck` (compiler is the fail-loud gate for the required
      deps).
- [x] 5.3 `pnpm lint` (must be clean, `--max-warnings 0`; no new
      `eslint.config.ts` exempt entry).
- [x] 5.4 `pnpm test` (full unit suite — not a folder-scoped run; memory
      `scoped-test-run-masks-red-tree`).
- [x] 5.5 `pnpm test:integration` for the period schedulers (single-thread;
      memory `integration-gate-single-thread-and-docker-up`).
- [x] 5.6 Live-verify one scheduled transition writes a real `audit` line to
      `app.log` (boot API from source; docker image is stale).

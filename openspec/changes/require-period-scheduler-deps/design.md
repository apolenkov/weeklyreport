## Context

Three period schedulers and `PeriodService` accept audit/policy/section
dependencies as OPTIONAL constructor args that fall back to silent
null-objects:

- `PeriodCreatorScheduler` / `AutoPublisherScheduler` / `AutoArchiverScheduler`:
  `auditLogger ?? createNullAuditLogger()` (period-creator.scheduler.ts:112,
  auto-publisher.scheduler.ts:40, auto-archiver.scheduler.ts:38). The module
  factory passes `undefined` (period.module.ts:114), so PRODUCTION runs on the
  no-op. Every scheduled `period.auto-*` audit event is discarded.
- `PeriodService.readReopenPolicy` defaults to `() => Promise.resolve(null)`
  (no gating), and `invalidateAnalyticsCache` defaults to
  `() => Promise.resolve(undefined)` (no cache flush). Both ARE wired in prod
  (period.module.ts:59, :65-71) — the risk is latent: the optional shape lets
  a future refactor silently disable reopen gating or cache invalidation. The
  `| null` reader return additionally lets an explicit null-returning reader
  skip gating even once the arg is required.
- `PeriodRepository.listSectionIds?` is an optional port method guarded at
  runtime by `if (this.repository.listSectionIds)` (period.service.ts:237).

Root cause is documented in period.module.ts:34-39: the AppLogger-backed
audit logger is built in `main.ts` (main.ts:460) and is NOT a Nest DI
provider, so the schedulers cannot inject it and default to the null-object.

Constraint (memory `web-tsconfig-typechecks-api-di-es-decorators`): API DI
must use `useFactory`/`inject`, NOT `@Inject` parameter decorators — the
latter fails TS1206 under the web tsconfig graph. `telegram.module.ts:53-67`
is the known-safe reference shape.

## Goals / Non-Goals

**Goals:**

- Scheduled period transitions emit real audit events in production.
- Make the three deps required — fail loud at composition, no runtime null.
- Wire the real `AuditLogger` at the composition root via a DI token.
- Remove the `if (this.repository.listSectionIds)` existence guard.

**Non-Goals:**

- `ingestionHook` stays optional/no-op (AI consumer removed — no real sink).
- Does NOT consolidate the pre-existing per-service file sinks (the five
  service/worker `createAppLogger` calls + the pre-boot logger) into one
  singleton — separate concern; this change only avoids adding a NEW sink for
  the audit path.
- No change to cron cadence, transition-writer semantics, or PROD reopen
  behavior. The only reopen behavior change is that a null-returning reader
  can no longer skip gating — that path is now type-forbidden, and prod never
  exercised it.
- `createNullAuditLogger()` is NOT deleted — tests keep passing it as an
  explicit choice.

## Decisions

### D1 — Promote AppLogger to a Nest token, not an inline rebuild

Register two providers: `APP_LOGGER` (`useFactory` injecting `ClsService` +
`ENV_CONFIG`, calling `createAppLogger`) and `AUDIT_LOGGER`
(`useFactory: (log) => createAuditLogger(log)`, `inject: [APP_LOGGER]`). The
three scheduler factories add `AUDIT_LOGGER` to their `inject` arrays and
pass the resolved logger as the now-required arg.

Alternative rejected — inline rebuild in the audit factory
(`useFactory: (cls) => createAuditLogger(createAppLogger({…, clsService: cls}))`).
Each `createAppLogger` with a `logDir` opens its OWN stateful file sink
(logger-file-sink.ts: `enqueueWrite`, rotation). The process ALREADY runs
several such sinks against the same `app.log` — the per-service loggers
(weekly-report:95, report-sections:102, search:58, review:71),
worker-observability:119, and both `main.ts` loggers — so the sink is NOT a
global singleton today and this change does not make it one. What it MUST NOT
do is add YET ANOTHER concurrent writer for the audit path. Reusing the
token-resolved post-CLS `APP_LOGGER` shares that one instance instead of
minting a fresh sink.

`main.ts` then resolves `app.get(APP_LOGGER)` for its own `logger` instead of
building a second post-CLS logger (main.ts:161-166), keeping exactly one
CLS-aware AppLogger in the process. The pre-bootstrap logger (main.ts:143,
built before Nest/CLS exists) is untouched.

### D2 — Required deps expressed structurally, verified by the type system

Drop the scheduler `= createNullAuditLogger()` default, the
`PeriodService` `= () => Promise.resolve(undefined)` (invalidateAnalyticsCache)
and `= () => Promise.resolve(null)` (readReopenPolicy) defaults, and the `?`
on `listSectionIds`. TypeScript then fails every construction site that omits
them — the compiler is the fail-loud gate; no runtime guard needed.

For `readReopenPolicy`, required-alone is only half the fix: an explicitly
passed `() => Promise.resolve(null)` still hits the `if (policy)` skip branch
(period.service.ts:325) and silently disables gating. So ALSO narrow
`ReopenPolicyReader`'s return from `| null` to a non-null policy and delete
the branch, making the read unconditional. Prod behavior is unchanged — the
prod reader (period.module.ts:65-71) reads the upserted `AppSettings`
singleton and never returned null; the null case existed only as a
reader-less-test sentinel, which making the arg required already removes.
Final ctor order: `(repo, invalidateAnalyticsCache, readReopenPolicy)` all
required, `ingestionHook` trailing-optional — legal TS, no reorder needed.

### Before / After data flow

```
BEFORE (prod)
  scheduler.runOnce → auditLogger(=null-object).periodAuto*  → DISCARDED
  publishPeriod → if (repo.listSectionIds) → maybe read      → conditional

AFTER (prod)
  AUDIT_LOGGER token → createAuditLogger(APP_LOGGER singleton)
  scheduler.runOnce → auditLogger.periodAuto* → app.log      → PERSISTED
  publishPeriod → repo.listSectionIds(reportId)              → unconditional
```

## Load-Bearing Invariants

- **period-dual-state**: untouched — no lifecycle-field writes change; the
  transition writer stays the sole author.
- **role-coverage-gate**: untouched — no tRPC procedure or middleware chain
  changes.
- **deferred-feature-pattern**: respected — `ingestionHook` remains the
  parked seam; not activated.

## Risks / Trade-offs

- [88+ tests construct `PeriodService`/schedulers on the current defaults]
  → make each test pass `createNullAuditLogger()` / a stub reader / a
  `listSectionIds` stub explicitly. Mechanical but broad; this is the bulk
  of the work and must land in the same change to keep the tree green.
- [Moving the prod logger into DI could change bootstrap ordering] → the
  post-CLS logger is built AFTER `NestFactory.create` + `app.get(ClsService)`;
  `app.get(APP_LOGGER)` resolves at the same point. The pre-boot adapter that
  covers the gap before CLS is unchanged.
- [The audit path adding yet another file sink if D1 is done wrong] →
  mitigated by construction: the `AUDIT_LOGGER` factory injects the single
  `APP_LOGGER` provider and never calls `createAppLogger` itself. The pre-boot
  logger (main.ts:143, its own `logDir` file sink) and the per-service loggers
  are pre-existing separate sinks this change leaves untouched — it adds none.

## Migration Plan

MVP phase, single deploy, no DB change, no flag. Steps: add the two token
providers → flip the three scheduler factories to inject `AUDIT_LOGGER` →
remove the defaults (audit, `invalidateAnalyticsCache`, `readReopenPolicy`) +
the `listSectionIds?` → narrow `ReopenPolicyReader` to non-null and drop both
runtime guards (the `if (this.repository.listSectionIds)` existence check and
the `if (policy)` skip branch) → repoint `main.ts` to `app.get(APP_LOGGER)` →
rewrite the now-stale ctor/type-doc comments → update construction sites in
tests. Rollback = revert the commit (no data migration to unwind).

## Open Questions

None blocking. `main.ts` logger repoint is the only non-mechanical edit; if
it proves noisier than expected, a smaller fallback is to keep `main.ts`
building its logger and register it via a `useValue` on a dynamic module —
but D1's single-provider shape is preferred and expected to hold.

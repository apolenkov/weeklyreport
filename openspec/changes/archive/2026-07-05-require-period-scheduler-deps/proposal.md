## Why

The period schedulers and `PeriodService` take their audit/policy/section/cache
dependencies as OPTIONAL constructor args with silent null-object defaults
(`auditLogger ?? createNullAuditLogger()`,
`invalidateAnalyticsCache = () => Promise.resolve(undefined)`,
`readReopenPolicy = () => Promise.resolve(null)`, `listSectionIds?`). In
production the auto-create/publish/archive schedulers
run on the `createNullAuditLogger()` fallback (period.module.ts:34-39,
:112) — every scheduled lifecycle transition emits its audit event into a
no-op, so the compliance trail for machine-driven state changes is silently
empty. Nothing at boot tells anyone. This is exactly the "no silent default
for product config" rule (docs/exemplary-code-standard.md).

## What Changes

- Promote the AppLogger-backed `AuditLogger` into the Nest DI graph
  (`APP_LOGGER` + `AUDIT_LOGGER` tokens, `useFactory`/`inject` — the
  repo's known-safe shape, telegram.module.ts:53-67), and inject the REAL
  sink into all three schedulers.
- Make the scheduler `auditLogger` a REQUIRED constructor arg — drop the
  `?? createNullAuditLogger()` default in all three scheduler classes.
- Make `PeriodService.readReopenPolicy` REQUIRED and narrow its return type
  from `| null` to a non-null policy, dropping the `if (policy)` skip-gating
  branch (period.service.ts:325). It is already wired in prod
  (period.module.ts:65-71); the null escape hatch let an explicitly-passed
  `() => Promise.resolve(null)` silently disable reopen gating even after the
  arg became required — narrowing closes the trap fully, not half.
- Make `PeriodService.invalidateAnalyticsCache` REQUIRED — drop its
  `() => Promise.resolve(undefined)` no-op default. It is prod-wired to
  `() => cache.invalidateAll()` (period.module.ts:59), the identical
  latent-trap class as `readReopenPolicy`: a future refactor could silently
  drop cache invalidation. Making arg 3 required already forces every site to
  pass arg 2 positionally, so requiring arg 2 is coherent at near-zero extra
  cost. Final ctor order: `(repo, invalidateAnalyticsCache, readReopenPolicy)`
  all required, `ingestionHook` trailing-optional.
- Make the `PeriodRepository.listSectionIds` port method REQUIRED and drop
  the `if (this.repository.listSectionIds)` runtime existence guard
  (period.service.ts:237).
- `createNullAuditLogger()` stays — but only as an EXPLICIT choice tests
  pass, never a code default.

## Non-goals

- `ingestionHook` stays optional/no-op: the AI/RAG consumer was removed,
  there is no real sink to wire. Making it required would be wrong.
- Does NOT consolidate the existing per-service file sinks
  (weekly-report / report-sections / search / review services +
  worker-observability + the pre-boot logger each build their own
  `createAppLogger` with an independent `logDir` file sink). That is a
  separate concern; this change only avoids adding ANOTHER sink for the audit
  path by reusing the token-resolved `APP_LOGGER`.
- No behavior change to the scheduling cadence, cron windows, or the
  transition-writer semantics.
- Not touching `main.ts`'s pre-bootstrap logger; only the post-CLS
  singleton moves into the graph.

## Capabilities

### New Capabilities

- `period-scheduler-wiring`: the composition-root contract that scheduled
  period transitions emit real audit events and that scheduler/service
  dependencies are mandatory (fail-loud), with no silent null-object
  substitution in production.

### Modified Capabilities

<!-- None: period-dual-state and period-lifecycle-ui behavior is unchanged;
     this change only hardens the wiring behind them. -->

## Impact

- Code: `apps/api/src/modules/period/period.module.ts`, the three
  `*.scheduler.ts` classes, `period.service.ts` (`PeriodRepository` port +
  guard, required `invalidateAnalyticsCache` / `readReopenPolicy`,
  non-null `ReopenPolicyReader`, stale ctor/type-doc comments),
  `apps/api/src/lib/audit-logger.ts` (token exports), `main.ts`
  (resolve `APP_LOGGER` from the container instead of building its own).
- Tests: every construction site of `PeriodService` and the schedulers must
  pass the now-required deps explicitly (the classes note 88+ tests lean on
  the current defaults — the bulk of the work).
- No DB, schema, or API-contract change.

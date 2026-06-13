# Add scope-accessed audit event

## Why

The audit trail is asymmetric: a denied cross-group access is logged, a
granted one is not. The deny path emits `scopeDenied`
(`apps/api/src/infrastructure/trpc/trpc.router.ts:1585`,
`:2156`), but when the weekly-report read actually surfaces a product a
group reaches only through the explicit `GroupProduct` join, nothing is
recorded — there is a live `TODO(scopeAccessed-audit)` at
`apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts:79`.
A security reviewer can see who was turned away but not who legitimately
read another group's data, which is exactly the trail an investigation
needs.

## What Changes

1. Add a `scopeAccessed` event to the `AuditLogger` interface and both
   implementations (`apps/api/src/lib/audit-logger.ts:18`,
   `:177`; type at `apps/api/src/lib/audit-logger-types.ts:224`). It joins
   `scopeDenied` as the access-side counterpart, emitted at `info`.
2. Emit it from the weekly-report read path when, and only when, a
   product surfaces for a non-admin caller through the explicit
   cross-group edge (a product the caller's group reaches via
   `GroupProduct`, not through the section/user axis it would see anyway).
3. Control volume: reads are frequent, so the emit is deduplicated
   per request and the payload carries the surfaced product/group ids,
   the caller, and the route — never row contents. See `design.md` for
   the dedupe-vs-sampling decision.
4. Retire `TODO(scopeAccessed-audit)` at
   `weekly-report.prisma-repository.ts:79`; the deferred note in the
   comment block (`:79`-`:81`) is removed once the event exists.
5. Unit tests: the logger emits the new event with the whitelisted
   payload; the no-op logger stays silent; the emit fires once per
   cross-group surface and never for same-group or admin reads.

**Non-goals:**

- No change to scope-filter semantics or to what data is returned;
  this is observability only (`scopeWhere` at
  `weekly-report.prisma-repository.ts:340` is untouched).
- No new audit transport, file rotation, or env var — the event rides
  the existing `AppLogger` envelope, same as every other audit event.
- No coverage of other read surfaces (archive list/detail, admin
  reads); this change closes only the weekly-report cross-group gap the
  TODO marks.
- No new color tokens, no UI strings — this is a backend-only path.
- Does not subsume the deferred `audit-log-coverage-before-uat` memo
  (`openspec/deferred/audit-log-coverage-before-uat/proposal.md`), which
  audits logging breadth for UAT and does not mention `scopeAccessed`.

## Capabilities

### New Capabilities

- `scope-accessed-audit`: a granted cross-group product read by a
  non-admin caller emits a structured `scopeAccessed` audit event
  carrying the caller, the surfaced product/group ids, and the route;
  the emit is deduplicated per request and never carries row contents.

### Modified Capabilities

<!-- none: repository-scope-guard governs the deny/guard path and is
     untouched; this change adds an access-side audit event, not a new
     scope rule. status-color-semantics and ui-control-density do not
     apply (backend-only). -->

## Impact

- `apps/api/src/lib/audit-logger-types.ts` — new `AuditEvent` member,
  `ScopeAccessedInput` type, interface method.
- `apps/api/src/lib/audit-logger.ts` — `scopeAccessed` in the real and
  no-op loggers.
- `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`
  — surface the cross-group flag from the read; remove the TODO.
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — emit at the
  `weeklyReport.get` query where `ctx.session` and `ctx.ip` are
  available (mirrors the `scopeDenied` callsites).
- Tests: `apps/api/src/lib/audit-logger.test.ts` and the weekly-report
  read tests.

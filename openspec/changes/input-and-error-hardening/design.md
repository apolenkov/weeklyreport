## Context

The 2026-06-28 repo-excellence-review identified a cluster of low-severity
but real defensive gaps across several surfaces:

1. **Auth** — `jwt.verify` in `auth.controller.ts` has no `algorithms` pin.
2. **Middleware** — `correlation-id.middleware.ts` adopts `x-request-id` verbatim.
3. **Shared schema** — `search.ts` uses `z.string().min(2).max(200)` for the `q`
   field (correct min-2 floor) but has no null-byte guard, letting null bytes
   reach `plainto_tsquery`.
4. **tRPC router** — `dev.wipeAndReseed` uses `protectedProcedure` instead of
   `adminProcedure`.
5. **Prisma seeds** — `seed.ts` and `backfill-policy-rules.ts` skip
   `assertNonProdDestructive` that every sibling script carries.
6. **Audit types** — `'period.manual-edit'` is emitted but absent from the
   `AuditEvent` union in `audit-logger-types.ts`.
7. **Shared schema** — the `telemetry.summary` sparkline schema bound is
   `.max(8)` while the only producer emits 4 and the doc comment says ≤ 4.
8. **Comments** — three stale comments mislead future maintainers.

Most are confined to `apps/api`, `packages/shared`, and `prisma/`. One has a
UI follow-on: restricting `dev.wipeAndReseed` to `adminProcedure` (item 4)
breaks the `DevRoleSwitcher` data-reset controls, which render for every dev
role and call that procedure — non-admin dev sessions would now hit a
`FORBIDDEN` alert. So the dev-only `role-switcher.tsx` reset controls must be
gated behind the admin role (see Decision 4). No schema migration and no new
external dependency.

## Goals / Non-Goals

**Goals:**

- Satisfy the five new `api-input-hardening` requirements (including the
  admin-only `DevRoleSwitcher` reset controls).
- Extend `destructive-db-guard` spec to cover seed/backfill scripts.
- Complete the `AuditEvent` union so it matches runtime behavior.
- Pin the `telemetry-summary-contract` sparkline bound to ≤ 4.
- Correct three stale comments that carry false contracts.

**Non-goals:**

- Revocation/deactivation bypass in PDF export and Bull Board (separate change).
- Dead-code removal (separate cleanup).
- Admin/org null-logger replacement (tracked separately).
- Any UI change beyond gating the dev-only `DevRoleSwitcher` reset controls
  behind the admin role (the direct consequence of the `dev.wipeAndReseed`
  restriction); no migration; no new dependency.

## Decisions

### 1. JWT algorithm pin: pass options object to jwt.verify

`jwt.verify(token, secret, { algorithms: ['HS256'] })` is the standard
jsonwebtoken API. No wrapper or abstraction needed — the call site is a single
function in `auth.controller.ts`. Alternative (a custom verify helper) adds
indirection with no benefit at this call-count.

### 2. x-request-id: validate inline in the middleware, not in a Zod schema

The header is infrastructure-level input processed before any tRPC context
exists. A Zod schema would require importing `@customreport/shared` into the
middleware, which currently has no shared dependency. A concise regex
(`/^[\x20-\x7E]{1,128}$/`) inline in the middleware is the minimal, zero-dependency
approach. If the header fails the check, generate a UUID v4 via the same
`randomUUID()` already used in the happy path.

### 3. search-q: use safeText() from the project helper

`safeText({ min: 2, max: 200 })` matches the project convention documented in
`openspec/config.yaml` ("use `safeText()` helper for user-facing text fields").
The min-2 floor is preserved (the current schema already enforces `min(2)`,
and the inline comment documents min-2 as the deliberate floor); switching to
`safeText` only adds the null-byte and invisible-only refinements. The
null-byte guard is built into `safeText` by its existing implementation.
No new helper needed.

### 4. dev.wipeAndReseed: change one identifier + gate the UI controls

Replace `protectedProcedure` with `adminProcedure` at the single call site in
`trpc.router.ts`. The production fence (`AUTH_DEV_MODE`) is unaffected. The
role-coverage gate passes because `adminProcedure` is already one of the 9
canonical builders.

This procedure is consumed by exactly one client: the dev-only
`DevRoleSwitcher` (`apps/web/src/components/dev/role-switcher.tsx`), whose four
"Wipe + Reseed" / "Wipe reports" controls render for every dev role. With the
restriction in place, a lead/head/viewer dev session that triggers a reset
would get a `FORBIDDEN` error surfaced as an `alert(...)`. To keep the UI
honest, those reset controls MUST be hidden (or disabled) unless the current
dev session role is `admin`. The role switcher does not currently read its own
session role, so the implementer adds that minimal lookup; the mechanism is
left to implementation. This is the only UI change in the scope.

### 5. Seed guard: call assertNonProdDestructive at the top of main()

Follow the pattern of `seed-simple.ts`, `seed-demo.ts`, and `reset-hard.ts`:
call `assertNonProdDestructive('seed')` (or `'backfill-policy-rules'`) as the
very first statement in `main()`. This is additive and non-breaking.

### 6. AuditEvent union: add the literal string AND type every emit site

Add `| 'period.manual-edit'` to the `AuditEvent` type in `audit-logger-types.ts`.

Adding the union member alone is NOT sufficient to satisfy the
`enum-state-hygiene` "undeclared event string is a compile error" scenario:
every event string is written as a raw object literal passed to
`logger.info(AUDIT_MESSAGE, { event: '…', … })`, and `AppLogger.info` accepts
`Record<string, unknown>`, so the `event` field is never checked against
`AuditEvent`. A typo or undeclared event would compile cleanly.

Decision: introduce a typed local `emit` helper inside `createAuditLogger` and
route every emit object literal through it, so the compiler checks each `event`
string against `AuditEvent`. The helper's payload parameter is typed as
`{ event: AuditEvent } & Record<string, unknown>` — the `event` field is pinned
to the union while the index signature carries the per-event fields (`periodId`,
`changes`, `procedure`, etc.) without per-event payload types. A bare
`satisfies AuditEnvelope` is rejected: it flags the extra per-event keys as
excess properties and `AuditEnvelope` lacks those fields.

Event strings only ever appear as literals inside `createAuditLogger`; all
callers use the typed `AuditLogger` interface methods. So routing the ~15 emit
sites in `audit-logger.ts` through the typed helper fully covers the
compile-error scenario.

## Data Flow

No data-flow changes. All modifications are at the validation or type-declaration
layer with no new persistence paths.

```
Before:
  inbound x-request-id   →  CLS correlationId (verbatim, unbounded)
  search q               →  z.string().min(2).max(200) → plainto_tsquery (null-byte passes)
  jwt.verify(token, sec) →  payload (any alg)
  dev.wipeAndReseed      →  protectedProcedure (any role)

After:
  inbound x-request-id   →  /^[\x20-\x7E]{1,128}$/ or fresh UUID → CLS correlationId
  search q               →  safeText({min:2,max:200}) → plainto_tsquery
  jwt.verify(token, sec, { algorithms:['HS256'] }) →  payload
  dev.wipeAndReseed      →  adminProcedure (admin only)
```

## Invariants Preserved

- **Role-coverage gate**: `adminProcedure` is a canonical builder; switching from
  `protectedProcedure` keeps the gate green.
- **Destructive-db guard**: adding the guard call extends, not changes, the guard's
  surface. Existing tests remain valid.
- **safeText convention**: using the project helper is spec-mandated; no new
  pattern introduced.

## Risks / Trade-offs

- **`dev.wipeAndReseed` role tightening**: if a CI fixture or test calls wipeAndReseed
  with a non-admin session it will now get `FORBIDDEN`. Check test helpers that call
  this endpoint and ensure they use an admin token. The dev-only `DevRoleSwitcher`
  reset controls are also gated to admin sessions (Decision 4), so a non-admin dev
  session no longer exposes a control that would fail with a `FORBIDDEN` alert.
- **x-request-id silent fallback**: invalid headers are silently replaced rather than
  rejected with a 400. This matches the principle of least surprise for
  infrastructure middleware (a malformed correlation id should not crash a legitimate
  request). The trade-off is that bad values are not surfaced to callers.
- **sparkline max bound**: changing `.max(8)` to `.max(4)` is a tightening that
  rejects inputs between 5–8 entries. Currently no producer sends more than 4;
  verify via grep before shipping.

## Migration Plan

All changes are backward-compatible for production. No migration, no feature flag.

Order: shared schemas first (search safeText, telemetry sparkline contract +
its test), then api middleware/controller, then the `dev.wipeAndReseed`
restriction together with the `DevRoleSwitcher` admin-only gating, then seed
scripts, then audit types, then comment fixes. Each change is a single-commit
unit.

## Open Questions

- None blocking. Sparkline max bound: confirm no producer emits > 4 via grep
  before committing the schema change.

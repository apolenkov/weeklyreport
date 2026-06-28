## Context

The 2026-06-28 repo-excellence-review identified a cluster of low-severity
but real defensive gaps across three surfaces:

1. **Auth** — `jwt.verify` in `auth.controller.ts` has no `algorithms` pin.
2. **Middleware** — `correlation-id.middleware.ts` adopts `x-request-id` verbatim.
3. **Shared schema** — `search.ts` uses bare `z.string()` for the `q` field, letting
   null bytes reach `plainto_tsquery`.
4. **tRPC router** — `dev.wipeAndReseed` uses `protectedProcedure` instead of
   `adminProcedure`.
5. **Prisma seeds** — `seed.ts` and `backfill-policy-rules.ts` skip
   `assertNonProdDestructive` that every sibling script carries.
6. **Audit types** — `'period.manual-edit'` is emitted but absent from the
   `AuditEvent` union in `audit-logger-types.ts`.
7. **Comments** — four stale comments mislead future maintainers.

All are confined to `apps/api`, `packages/shared`, and `prisma/`. No schema
migration, no new external dependency, no UI change.

## Goals / Non-Goals

**Goals:**

- Satisfy the four new `api-input-hardening` requirements.
- Extend `destructive-db-guard` spec to cover seed/backfill scripts.
- Complete the `AuditEvent` union so it matches runtime behavior.
- Correct four stale comments that carry false contracts.

**Non-goals:**

- Revocation/deactivation bypass in PDF export and Bull Board (separate change).
- Dead-code removal (separate cleanup).
- Admin/org null-logger replacement (tracked separately).
- Any UI, migration, or new dependency.

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

`safeText({ min: 1, max: 200 })` matches the project convention documented in
`openspec/config.yaml` ("use `safeText()` helper for user-facing text fields").
The null-byte guard is built into `safeText` by its existing implementation.
No new helper needed.

### 4. dev.wipeAndReseed: change one identifier

Replace `protectedProcedure` with `adminProcedure` at the single call site in
`trpc.router.ts`. The production fence (`AUTH_DEV_MODE`) is unaffected. The
role-coverage gate passes because `adminProcedure` is already one of the 9
canonical builders.

### 5. Seed guard: call assertNonProdDestructive at the top of main()

Follow the pattern of `seed-simple.ts`, `seed-demo.ts`, and `reset-hard.ts`:
call `assertNonProdDestructive('seed')` (or `'backfill-policy-rules'`) as the
very first statement in `main()`. This is additive and non-breaking.

### 6. AuditEvent union: add the literal string

Add `| 'period.manual-edit'` to the `AuditEvent` type in `audit-logger-types.ts`.
Consider additionally typing the `event` field in the audit-log helper's call
signature as `AuditEvent` to make future omissions a compile error rather than
a runtime surprise.

## Data Flow

No data-flow changes. All modifications are at the validation or type-declaration
layer with no new persistence paths.

```
Before:
  inbound x-request-id   →  CLS correlationId (verbatim, unbounded)
  search q               →  z.string() → plainto_tsquery (null-byte passes)
  jwt.verify(token, sec) →  payload (any alg)
  dev.wipeAndReseed      →  protectedProcedure (any role)

After:
  inbound x-request-id   →  /^[\x20-\x7E]{1,128}$/ or fresh UUID → CLS correlationId
  search q               →  safeText({min:1,max:200}) → plainto_tsquery
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
  this endpoint and ensure they use an admin token.
- **x-request-id silent fallback**: invalid headers are silently replaced rather than
  rejected with a 400. This matches the principle of least surprise for
  infrastructure middleware (a malformed correlation id should not crash a legitimate
  request). The trade-off is that bad values are not surfaced to callers.
- **sparkline max bound**: changing `.max(8)` to `.max(4)` is a tightening that
  rejects inputs between 5–8 entries. Currently no producer sends more than 4;
  verify via grep before shipping.

## Migration Plan

All changes are backward-compatible for production. No migration, no feature flag.

Order: shared schemas first, then api middleware/controller, then seed scripts,
then audit types, then comment fixes. Each change is a single-commit unit.

## Open Questions

- None blocking. Sparkline max bound: confirm no producer emits > 4 via grep
  before committing the schema change.

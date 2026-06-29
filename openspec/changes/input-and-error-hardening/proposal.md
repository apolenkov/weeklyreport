## Why

A focused security-review pass (repo-excellence-review-2026-06-28) identified
a cluster of low-severity but real defensive gaps: the JWT verifier accepts any
algorithm, inbound headers and query params lack byte-safety guards, two seed
scripts bypass the established non-prod destructive guard, the dev wipe endpoint
is callable by any authenticated role, and the canonical `AuditEvent` union is
missing a member that is already emitted at runtime. Several related code
comments are stale and mislead maintainers. None block MVP, but they accumulate
maintenance debt and will be harder to fix post-production-cutover.

## What Changes

- Pin `jwt.verify` to `algorithms: ['HS256']` — defense-in-depth algorithm
  bind to rule out alg-substitution class of attacks.
- Cap and charset-validate the inbound `x-request-id` header before adopting
  it as the CLS `correlationId`.
- Guard `search.q` with `safeText` to block null-byte input from reaching
  `plainto_tsquery` (currently causes an unhandled 500).
- Restrict `dev.wipeAndReseed` tRPC procedure from `protectedProcedure` to
  `adminProcedure` — any authenticated user in a shared dev/UAT environment
  can currently trigger a full migrate-reset + reseed. As a direct consequence,
  gate the dev-only `DevRoleSwitcher` reset controls (`role-switcher.tsx`)
  behind the admin role so non-admin dev sessions do not hit a `FORBIDDEN`
  alert.
- Add `assertNonProdDestructive` at the top of `seed.ts` and
  `backfill-policy-rules.ts` — two scripts that write against `DATABASE_URL`
  without the guard their sibling scripts already carry.
- Add `'period.manual-edit'` to the `AuditEvent` TypeScript union so the
  canonical type is exhaustive and consumer switches can handle it at compile
  time.
- Tighten the `telemetry.summary` sparkline bound from `.max(8)` to `.max(4)`
  — a behavioral shared-contract change matching the only producer
  (`onTimeRatioPerPeriod(4)`) and the schema doc comment.
- Fix stale comments: `stageIds` storage description (comma-join → native
  array), `sessionRoleSchema` wider-comment, seed ownership invariant.

## Capabilities

### New Capabilities

- `api-input-hardening`: Inbound request sanitization — x-request-id cap,
  search-q null-byte guard, JWT algorithm pin, dev-wipe role scope, and the
  admin-only `DevRoleSwitcher` reset controls that follow from it.
- `telemetry-summary-contract`: ADDED requirement — the `telemetry.summary`
  sparkline array MUST be length ≤ 4, tightening the schema bound to match its
  single producer.

### Modified Capabilities

- `destructive-db-guard`: ADDED requirement — `seed.ts` and
  `backfill-policy-rules.ts` must call `assertNonProdDestructive` at the
  start of their `main()` function for consistency with every sibling
  script.
- `enum-state-hygiene`: ADDED requirement — every audit event string emitted
  at runtime must be a declared member of the `AuditEvent` TypeScript
  string-literal union; the parity converse of the existing "declared value
  must have a writer" rule.

## Impact

- `apps/api/src/modules/auth/auth.controller.ts` — jwt.verify options.
- `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts` —
  x-request-id cap.
- `packages/shared/src/schemas/search.ts` — search-q safeText.
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — dev.wipeAndReseed
  procedure builder.
- `apps/web/src/components/dev/role-switcher.tsx` — gate reset controls behind
  the admin role.
- `packages/shared/src/schemas/telemetry.ts` — sparkline `.max(8)` → `.max(4)`
  (behavioral) plus its test `telemetry.test.ts`.
- `prisma/seed.ts`, `prisma/backfill-policy-rules.ts` — guard call.
- `apps/api/src/lib/audit-logger-types.ts` — AuditEvent union.
- `packages/shared/src/schemas/report-primitives.schema.ts`,
  `packages/shared/src/schemas/auth.ts`,
  `prisma/seed-simple.ts` — comment corrections.

## Non-goals

- Runtime deactivation/revocation checks for PDF export and Bull Board
  (tracked separately as `enforce-deactivation-pdf-bullboard`).
- Removing dead module-level routers or dead components (separate cleanup).
- Changing admin log injection (a no-op logger gap tracked separately).

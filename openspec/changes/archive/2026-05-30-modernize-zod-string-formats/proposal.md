# Modernize Zod string-format validators to the top-level API

## Why

Zod v4 (`zod@^4.1.0`) deprecated the method-style string-format validators —
`z.string().uuid()`, `.email()`, `.url()`, `.datetime()` — in favour of
top-level functions (`z.uuid()`, `z.email()`, `z.url()`, `z.iso.datetime()`).
After `report.ts` was split into per-domain `*.schema.ts` files (`cf2ec421`),
the deprecation surfaced as editor diagnostics across the shared schemas and the
tRPC router. They were warnings, not errors, but they accumulate noise and drift
from the supported API.

The migration is behavior-preserving: the repo is already on Zod v4, so the
method-style forms were already the strict v4 validators. Verified empirically —
`z.uuid()` and `z.string().uuid()` accept/reject identical inputs (incl.
non-RFC-4122 literals, both reject), `z.url().startsWith("postgresql://")`
behaves as before, and `z.iso.datetime()` matches the old `.datetime()`.

## What Changes

- Replace every deprecated method-style call with its top-level equivalent
  across 11 files (9 shared schemas + tRPC router + API env schema):
  - `z.string().uuid()` → `z.uuid()` (140 sites)
  - `z.string().email()` → `z.email()` (3 sites)
  - `z.string().url()` → `z.url()` (7 sites, incl. `env.schema.ts`
    `.startsWith("postgresql://")` chains)
  - `z.string().datetime()` → `z.iso.datetime()` (1 site)
- No schema semantics change. Pure API-surface modernization.

## Impact

- **Affected files:** `apps/api/src/infrastructure/config/env.schema.ts`,
  `apps/api/src/infrastructure/trpc/trpc.router.ts`, and
  `packages/shared/src/schemas/{report,section,stage,period,search,auth,
analytics,ai-summary}.schema.ts` plus
  `packages/shared/src/admin/reminder-policy.schema.ts`.
- **Risk:** Low. Behavior-preserving; guarded by the full test suite and
  `pnpm typecheck`.
- **Out of scope:** No new validators, no stricter rules, no lint-enforcement
  rule for the convention.

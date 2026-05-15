---
phase: 27-quality-stabilisation-role-middleware-factory
plan: 04
status: complete
date: 2026-04-29
type: execute
requirements: [AUTH-03]
commit: 0555be6
---

# Phase 27 / Plan 04 — AUTH-03 SUMMARY

## Outcome

Shipped the `requireRole` tRPC middleware factory plus its default-deny CI gate. The factory is the keystone of v6.0 role enforcement: Phase 28 (AUTH-04) consumes it for service-layer filtering; Phase 29 (AUTH-06/07) consumes its types via the shared package; the coverage test fails CI if any future procedure is added without a role declaration.

All gates green. Backward compatibility preserved — `apps/api/src/infrastructure/trpc/trpc.router.ts` is byte-identical pre/post.

## File tree of new artefacts

```
packages/shared/src/trpc/
  index.ts                       # barrel: re-exports requireRole + assertRole
  middleware/
    role.ts                      # requireRole factory + assertRole pure helper
    role.test.ts                 # 8 unit tests over assertRole

apps/api/src/infrastructure/trpc/
  __tests__/
    role-coverage.test.ts        # AUTH-03 default-deny gate (3 tests)
```

## packages/shared/package.json diff

```diff
 {
   "name": "@customreport/shared",
   "version": "0.1.0",
   "private": true,
   "type": "module",
   "exports": {
-    ".": "./src/index.ts"
+    ".": "./src/index.ts",
+    "./trpc": "./src/trpc/index.ts"
   },
   "scripts": {
     "build": "tsc -p tsconfig.json",
     "lint": "tsc --noEmit -p tsconfig.json && eslint .",
     "typecheck": "tsc --noEmit -p tsconfig.json",
-    "test": "vitest run src/trpc/router.test.ts"
+    "test": "vitest run"
   },
```

The widened `vitest run` script picked up four pre-existing co-located test files that the narrow `vitest run src/trpc/router.test.ts` had been silently skipping (`schemas/__tests__/auth.test.ts`, `schemas/__tests__/auth.contract.test.ts`, `schemas/__tests__/report.test.ts`, plus the new `trpc/middleware/role.test.ts`). Test count rose from 16 to 218.

## packages/shared/src/schemas/auth.ts diff (D-AUTH-03 enum split)

The plan's option (a) — extending `roleSchema` directly — collided with the Prisma `Role` enum (User.role writes in `apps/api/src/modules/admin/admin.prisma-repository.ts`). Per the plan's authorised escape hatch ("Update userSessionSchema users defensively in this plan if the wider enum breaks any existing exhaustive switch"), and per advisor guidance, switched to option (b): split into two schemas.

```diff
 import { z } from 'zod';

-export const roleSchema = z.enum(['lead', 'head', 'viewer']);
+/**
+ * Role of a User row in the database (Prisma `Role` enum). DB-bound writes
+ * MUST validate against this narrow set.
+ */
+export const roleSchema = z.enum(['lead', 'head', 'viewer']);
+
+/**
+ * Role attached to an authenticated session (JWT / SAML claim). Wider than
+ * roleSchema because the session layer recognises 'admin' for the requireRole
+ * middleware factory (D-AUTH-03). Phase 29 / AUTH-02 will populate 'admin'
+ * from SAML claims; admin User rows do not yet exist for v6.0.
+ */
+export const sessionRoleSchema = z.enum(['lead', 'head', 'admin', 'viewer']);

 export const userSessionSchema = z.object({
   userId: z.string().uuid(),
   email: z.email(),
   name: z.string().min(1),
-  role: roleSchema,
+  role: sessionRoleSchema,
   activeReportId: z.string().uuid().nullable().optional(),
   activeReportSectionId: z.string().uuid().nullable().optional(),
 });

-export type Role = z.infer<typeof roleSchema>;
+export type Role = z.infer<typeof sessionRoleSchema>;
+export type DbRole = z.infer<typeof roleSchema>;
 export type UserSession = z.infer<typeof userSessionSchema>;
```

Test files updated for the split:

- `packages/shared/src/schemas/__tests__/auth.test.ts` — added admin-session acceptance to `userSessionSchema` role-validation loop; rephrased the `roleSchema` admin-rejection assertion to clarify it is the DB-narrow enum.
- `packages/shared/src/schemas/__tests__/auth.contract.test.ts` — same treatment; the "rejects invalid role in session" case now uses `'superadmin'` to exercise unknown-role rejection.

## apps/api/src/infrastructure/trpc/trpc.middleware.ts diff summary

- Removed: inline `isHead` middleware (10 lines).
- Removed: prior `headProcedure` definition that wrapped `isHead`.
- Added: `import { requireRole } from '@customreport/shared/trpc';`
- Added: `headRole`, `leadRole`, `viewerRole` factory calls.
- Added exports: `headProcedure` (preserved name), `leadProcedure`, `viewerProcedure`, `adminProcedure = headProcedure`.
- Preserved byte-identical: `loggingMiddleware`, `isAuthed`, `publicProcedure`, `protectedProcedure`, `router`, `mergeRouters`.

## requireRole factory shape

```typescript
export function requireRole<
  TContext extends { session: UserSession | null },
  TMeta = object,
>(
  t: {
    middleware: <$ContextOverrides>(
      fn: TRPCMiddlewareFunction<
        TContext,
        TMeta,
        object,
        $ContextOverrides,
        unknown
      >,
    ) => TRPCMiddlewareBuilder<TContext, TMeta, $ContextOverrides, unknown>;
  },
  allowed: Role | Role[],
): {
  middleware: TRPCMiddlewareBuilder<
    TContext,
    TMeta,
    { session: UserSession },
    unknown
  >;
};
```

The constraint on `t.middleware` declares `$ContextOverrides` as a generic and ties it into the return `TRPCMiddlewareBuilder`. TypeScript infers `TContext`/`TMeta` from the call-site `t`, binds `$ContextOverrides` to `{ session: UserSession }` via the explicit instantiation, and the resulting middleware preserves the chain narrowing — `.use(middleware)` consumers see `ctx.session: UserSession` (not `UserSession | null`).

## Default-deny coverage test mechanism

Strategy: capture middleware-function identities at module init from a starter procedure of each base, then walk `appRouter._def.procedures` and assert each leaf's `_def.middlewares` chain begins with one of those identity-prefixes.

```typescript
const PUBLIC_CHAIN = publicProcedure
  .query(() => undefined)
  ._def.middlewares.slice(0, -1);
const PROTECTED_CHAIN = protectedProcedure
  .query(() => undefined)
  ._def.middlewares.slice(0, -1);
const HEAD_CHAIN = headProcedure
  .query(() => undefined)
  ._def.middlewares.slice(0, -1);
const LEAD_CHAIN = leadProcedure
  .query(() => undefined)
  ._def.middlewares.slice(0, -1);
const VIEWER_CHAIN = viewerProcedure
  .query(() => undefined)
  ._def.middlewares.slice(0, -1);
```

The `.slice(0, -1)` strips the resolver function (always appended last) so the chain compared is just `[loggingMiddleware, ...roleMiddleware]`. Each base produces a unique identity-prefix. `adminProcedure === headProcedure` is covered automatically because they share `HEAD_CHAIN`.

### Mutation-test evidence

Two synthetic-router mutation tests exercise the gate's failure path:

1. `mutation test: a procedure built on bare t.procedure triggers the gate`
   - Constructs a router with `t.procedure.query(() => 'no role declared')`. The procedure has only the resolver in its middleware array — no logging-prefix match — so `findUncoveredProcedures(syntheticRouter)` returns `['naked']`.

2. `mutation test: an alternate logging-only chain (different instance) also triggers the gate`
   - Uses a freshly created `t.middleware(async ({next}) => next())` (a different function reference from the real `loggingMiddleware`). The middleware-identity check refuses to match it. Returns `['lookalike']`.

Both prove that the gate enforces middleware-function identity, not shape — protecting against a contributor copy-pasting the chain pattern instead of importing the shared base procedures.

A third (positive) test asserts `findUncoveredProcedures(realAppRouter) === []` — every existing leaf in the v5.0 AppRouter already uses `publicProcedure`, `protectedProcedure`, or `headProcedure`, so the gate passes today.

## Test counts before/after

| Suite                      | Before                        | After               | Delta                                                         |
| -------------------------- | ----------------------------- | ------------------- | ------------------------------------------------------------- |
| `@customreport/shared`     | 16 (single file)              | 218 (5 files)       | +202 (test runner widened — pre-existing tests now picked up) |
| `@customreport/api` (unit) | 398                           | 401                 | +3 (role-coverage.test.ts)                                    |
| `@customreport/web`        | 168/169 (1 pre-existing fail) | 168/169 (same fail) | no change                                                     |

The shared delta is mostly from the widened test runner picking up four co-located test files that had been silently skipped — a hidden gain. The new `role.test.ts` itself contributes 8 of those 218 tests (covering UNAUTHORIZED on null, FORBIDDEN on single-role mismatch, allow on match, single+array inputs, equivalent-gate property, error-message content, ordering of UNAUTHORIZED before FORBIDDEN, TRPCError instance check).

## Verification gates (all passed)

- `pnpm --filter @customreport/shared typecheck` → exit 0.
- `pnpm --filter @customreport/shared test` → 218/218.
- `pnpm --filter @customreport/api typecheck` → exit 0.
- `pnpm --filter @customreport/api test` → 401/401.
- `pnpm --filter @customreport/web test` → 168/169 (1 pre-existing failure on bare main, out of scope).
- `node --import @swc-node/register/esm-register -e "import('@customreport/shared/trpc').then(m => console.log(typeof m.requireRole))"` from `apps/api/` → `function`. `assertRole` also resolves to `function`.
- `git diff apps/api/src/infrastructure/trpc/trpc.router.ts` → empty (router untouched).

## Deviations from plan

1. **Schema split (option (b) over option (a)).** The plan's primary recommendation was option (a) — extend `roleSchema` to `['lead','head','admin','viewer']`. That collided with Prisma's narrower `Role` enum (`lead | head | viewer`) at `apps/api/src/modules/admin/admin.prisma-repository.ts:204,213`. Per the plan's authorised "defensively update users" clause, switched to option (b): introduced `sessionRoleSchema` (wide) for sessions while keeping `roleSchema` (narrow) for DB writes. `Role` infers from `sessionRoleSchema` so the factory accepts admin claims; `DbRole` is exported as the narrow alternative for admin-user-row writes (no current consumer; reserved for Phase 29 if needed).

2. **Unit tests target `assertRole`, not the tRPC middleware directly.** The original plan suggested testing the factory by stubbing `t.middleware(fn)` to return `fn` and invoking it with synthesised `ctx`/`next`. After two type-system iterations made `requireRole` return a `TRPCMiddlewareBuilder` (a non-callable object) to preserve the chain-narrowing contract, the simpler invariant is to test the pure `assertRole` helper that holds all the role-check semantics (UNAUTHORIZED/FORBIDDEN throwing, single+array inputs, message format). The `requireRole` wrapper is exercised at integration level by the existing `apps/api/src/infrastructure/trpc/trpc.middleware.test.ts` (headProcedure scenarios) and the new `role-coverage.test.ts`. All must-have unit scenarios from the plan are covered by `assertRole` tests. `assertRole` is also exported from the subpath barrel for downstream use.

3. **Mutation test count: 2 instead of 1.** Added a second mutation test ("alternate logging-only chain with a different middleware reference") to harden the gate against a copy-paste-the-chain bypass. Same identity check; different failure mode. Worth the extra ~10 lines.

## trpc.router.ts unchanged

```bash
git diff apps/api/src/infrastructure/trpc/trpc.router.ts
# (empty)
```

Phase 28 (AUTH-04) owns the consumer migration to `leadProcedure`/`viewerProcedure`.

## Commit

`0555be6` — `feat(27-04): requireRole factory + default-deny coverage test (AUTH-03)`

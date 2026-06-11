# Design — Consolidate tRPC Infrastructure Duplication

## Before / After — protected middleware chain

Before (repeated verbatim 7 times in `trpc.middleware.ts`):

```ts
export const headProcedure = t.procedure
  .use(metricsMiddleware)
  .use(loggingMiddleware)
  .use(headRoleMiddleware)
  .use(pdfExportGuard)
  .use(mutationAuditMiddleware);
```

After (the 5-middleware order defined once):

```ts
function buildProtectedProcedure(authMiddleware: typeof isAuthed) {
  return t.procedure
    .use(metricsMiddleware)
    .use(loggingMiddleware)
    .use(authMiddleware)
    .use(pdfExportGuard)
    .use(mutationAuditMiddleware);
}
export const protectedProcedure = buildProtectedProcedure(isAuthed);
export const headProcedure = buildProtectedProcedure(headRoleMiddleware);
// …5 more role builders; publicProcedure keeps its 2-middleware chain.
```

## Decisions

### D1 — Explicit standalone chain, NOT derived from publicProcedure

`buildProtectedProcedure` restates the full chain from `t.procedure`
rather than extending `publicProcedure`. Deriving would silently
propagate any future public-only middleware into every protected
chain — the factory must encode exactly
`metrics → logging → auth → pdfExportGuard → mutationAudit`.
Security-ordering contract: logging deliberately runs BEFORE auth
(failed-auth forensics) and metrics before logging (timing excludes
logger overhead, 47-03). Any "cleaner" reordering is a behavior change.

### D2 — Hard constraint: all 8 exported builder references stay identity-stable

`openspec/specs/role-coverage-gate` CI-gates every router procedure by
reference identity against the canonical builders' middleware chains.
The refactor keeps all 8 export names and every middleware constant's
identity; only where the `.use()` chain is written changes. Parameter
type: try `typeof isAuthed` (it and `buildRoleMiddleware(...)` results
should unify on `$ContextOverrides = { session: UserSession }`); if
tRPC 11 inference refuses, fall back to an explicit `MiddlewareBuilder`
annotation — verify against current tRPC 11 docs (Context7) before
coding. Type-inference drift into `AppRouter` and the web client is the
real risk; the pre-refactor pin test plus workspace `pnpm typecheck`
are the proof.

### D3 — hydrateSession stays file-local and private

`async function hydrateSession(session: UserSession, prisma:
PrismaService): Promise<UserSession>` composes the 4 existing helpers
unchanged, in current order. No export, no `HydrationStep` enum, no
mocking seam — the adversarial pass rejected that speculation; the
factory-level tests already cover the contract.

### D4 — Mutation and try/catch placement preserved

The helpers mutate the session in place, so the `{ ...DEV_SESSION }`
spread stays AT THE CALL SITE (moving it inside `hydrateSession` would
let the module constant be polluted across requests). The regular-path
call stays INSIDE the existing `try` — hydration failure must keep
degrading to PDF-verify then dev/null, not throw from the context
factory. JSDoc states the PDF skip is intentional Phase 32-B1 design.

### D5 — orgCache reset is test hygiene only

Two lines in `trpc.context.test.ts` (`clearOrgCache()` in
`beforeEach`); the production 5s-TTL cache behavior is untouched.

## Invariants

- `role-coverage-gate`: preserved, and the gate test gains the missing
  `leadershipProcedure` entry (aligns with the 8-builder spec).
- `period-dual-state`, `destructive-db-guard`,
  `deferred-feature-pattern`: untouched.

## Rollout

No schema, flags, or migrations. Downstream consumer is the web
client's inferred tRPC types; workspace gates prove stability. Known
residual weakness (recorded, not fixed here): the gate prefix-matches
on `[metricsMiddleware, loggingMiddleware]`, so it would not catch a
reordering or omission after slot 2 — the new chain-composition pin
test is the real safety net.

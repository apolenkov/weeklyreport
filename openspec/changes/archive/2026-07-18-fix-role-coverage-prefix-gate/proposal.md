## Why

`apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts:108` defines
`isProcedureChainAllowed` as a prefix match:

```ts
function isProcedureChainAllowed(middlewares: readonly unknown[]): boolean {
  return ALLOWED_CHAINS.some(({ chain }) => {
    if (middlewares.length < chain.length) return false;
    return chain.every((mw, i) => middlewares[i] === mw);
  });
}
```

`ALLOWED_CHAINS` includes `PUBLIC_CHAIN = [metricsMiddleware,
loggingMiddleware]` (2 entries). Every protected chain built by
`buildProtectedProcedure` in `trpc.middleware.ts` starts with the same two
middlewares — `metricsMiddleware` then `loggingMiddleware` — before the
role-specific middleware at slot 2. Because `PUBLIC_CHAIN` is a prefix of
every protected chain, `.some()` matches on `PUBLIC_CHAIN` alone and returns
`true` without ever inspecting slot 2 (the role/auth middleware) or slots 3-4
(`pdfExportGuard`, `mutationAuditMiddleware`).

The practical consequence: a procedure hand-built as
`t.procedure.use(metricsMiddleware).use(loggingMiddleware).use(<any role
middleware, including one that grants the wrong role or none at all>)` passes
the gate green, because its first two middlewares alone satisfy
`PUBLIC_CHAIN`. This is exactly the violation CLAUDE.md's role-coverage
invariant forbids: "tRPC procedures must use one of the 9 canonical
middleware-chain builders (matched by reference identity). Don't hand-roll a
chain." The gate as written cannot detect a hand-rolled chain that reuses the
two shared prefix middlewares, which is the most natural way to hand-roll one.

The existing mutation tests (`naked` bare procedure, `altPublic` with a
different logging middleware instance) don't exercise this path — both
produce chains that do NOT start with the real `metricsMiddleware` +
`loggingMiddleware` pair, so they still fail correctly. The gap is invisible
until a chain reuses the real shared prefix, which is the realistic
hand-rolling mistake.

Separately, `RouterRecord`/`RouterShape` (lines 119-123) are dead types —
`collectLeafProcedures` and `findUncoveredProcedures` use their own inline
parameter types and never reference `RouterRecord`/`RouterShape`. And the
`[AUTH-03]` tag in the diagnostic `console.error` (line 199) is ticket
archaeology that CLAUDE.md's comment-hygiene rule says to remove.

## What Changes

- Rewrite `isProcedureChainAllowed` to require a full-reference-identity
  match of one canonical chain from `ALLOWED_CHAINS`, with everything after
  that base restricted to tRPC's own per-procedure plumbing middlewares
  (`inputValidatorMiddleware` / `outputValidatorMiddleware` /
  `resolveMiddleware`, recognised by name — they are fresh closures per
  procedure and cannot be reference-compared). A literal exact-length
  match (the first drafted approach) is impossible: every finalized leaf
  procedure carries those trailing plumbing entries, so it would flag all
  92 legitimate procedures. Known residual: a middleware wilfully NAMED
  like a plumbing function still passes the tail check — out of scope,
  the gate targets accidental hand-rolls, not deliberate evasion.
- Add a regression/characterization test: a synthetic procedure built as
  `t.procedure.use(metricsMiddleware).use(loggingMiddleware).use(<fake role
middleware>)` (reusing the real shared prefix, differing only past slot 2)
  must be flagged as offending. This is the case the current prefix match
  misses and the exact-match fix must catch.
- Remove the unused `RouterRecord` / `RouterShape` types (lines 119-123).
- Remove the `[AUTH-03]` archaeology tag from the diagnostic `console.error`
  message; keep the diagnostic text itself (offending-path listing + fix
  hint).
- No production code changes — this file is test-only infrastructure (the
  role-coverage gate itself).

## Capabilities

### Modified Capabilities

- `role-coverage-gate` — the gate now requires a full-reference-identity
  canonical-base match with a plumbing-only tail instead of a
  length-tolerant prefix match, closing the gap where a hand-rolled chain
  reusing the shared metrics+logging prefix passed undetected.

## Impact

- Package: `@customreport/api`
- File: `apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts`
  (test-only; no runtime/production source changes)

## Non-goals

- Not changing `trpc.middleware.ts` or any of the 9 canonical procedure
  builders — the middleware chains themselves are already correct; only the
  test that verifies them is broken.
- Not adding a tenth procedure kind or changing role semantics.
- Not touching the `pdfExport` leadership-chain tests (lines 247-332) —
  those already assert exact-identity via `startsWithChain` plus a positive
  full-length check and are unaffected by this fix.

## 1. Narrow the catch boundary

- [ ] 1.1 `apps/api/src/infrastructure/trpc/trpc.context.ts`: in
      `resolveHumanSession`, move `deps.verifySessionToken(token)` into its
      own `try/catch` that returns `null` on throw
- [ ] 1.2 Let `isUserAccessBarred(...)` and `hydrateSession(...)` run outside
      that catch, so a throw from either propagates out of
      `resolveHumanSession` uncaught
- [ ] 1.3 Confirm the tRPC context factory (`createContextFactory`, line
      ~245) does not itself re-wrap `resolveHumanSession` in a
      swallow-to-null catch — if it does, narrow that one too so the error
      actually reaches the client as a 500

## 2. Tests

- [ ] 2.1 `trpc.context.test.ts`: add a case where `deps.verifySessionToken`
      throws → `resolveHumanSession` resolves to `null`
- [ ] 2.2 `trpc.context.test.ts`: add a case where `hydrateSession` (or a
      dependency it calls) throws → `resolveHumanSession` rejects/propagates
      the error, not `null`
- [ ] 2.3 `trpc.context.test.ts`: add a case where `isUserAccessBarred`
      throws → propagates, not `null`
- [ ] 2.4 Re-run `trpc.session-hydration.test.ts` unmodified — confirm the
      four-step happy path and org-cache upsert fallback still pass

## 3. Spec delta

- [ ] 3.1 `session-hydration-error-scoping`: ADD the requirement that
      `resolveHumanSession` only maps a token-verification failure to `null`
      and lets hydration/access-check errors propagate

## 4. Gates

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 `cd apps/api && pnpm test:integration`
- [ ] 4.4 `openspec validate session-hydration-error-scoping --strict`

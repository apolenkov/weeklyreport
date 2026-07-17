# Tasks

## 1. Characterization / regression pin (behavior change)

- [ ] 1.1 Add a test in `role-coverage.test.ts` that builds a synthetic
      chain as `t.procedure.use(metricsMiddleware).use(loggingMiddleware).use(<fake
role middleware>)` (reusing the real `metricsMiddleware` +
      `loggingMiddleware` exports, not stand-ins) and assert
      `findUncoveredProcedures` flags it — this pins the exact case the
      current prefix match misses.
- [ ] 1.2 Run this new test against the UNCHANGED `isProcedureChainAllowed`
      first and confirm it fails red (proves the pin actually exercises the
      bug, not a vacuous check), then proceed to the fix.

## 2. Fix the gate

- [ ] 2.1 Rewrite `isProcedureChainAllowed` to require
      `middlewares.length === chain.length` AND every slot matching by
      reference — no length-inequality-tolerant prefix match.
- [ ] 2.2 Re-run the task-1 pin and confirm it now passes green.
- [ ] 2.3 Re-run the existing suite (`naked`, `altPublic`,
      `AppRouter` full-coverage, `pdfExport` leadership-chain tests) and
      confirm all still pass unchanged.

## 3. Cleanup

- [ ] 3.1 Remove the unused `RouterRecord` / `RouterShape` types.
- [ ] 3.2 Remove the `[AUTH-03]` tag from the diagnostic `console.error`
      message; keep the rest of the diagnostic text.

## Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm --filter @customreport/api test:integration`

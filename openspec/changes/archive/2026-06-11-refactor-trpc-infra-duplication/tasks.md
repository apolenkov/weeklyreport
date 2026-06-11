# Tasks — Consolidate tRPC Infrastructure Duplication

Decisions D1-D5: `design.md`. Evidence anchors: `proposal.md` (verified
at HEAD 3f5be66f — re-verify line numbers if more commits land before
implementation). NOT STARTED — captured 2026-06-10.

**Standing execution note:** Sequential single-writer edits only;
parallel agents only for read-only analysis (repo lesson: parallel
mechanical edits pass gates but break behavior).

**Sequencing:** Wave 1 — start only after `refactor-test-db-cleanup` is
implemented (integration suites as safety net). Every edit below
touches `apps/api/src/infrastructure/trpc/`; never run these tasks in
parallel with each other or with any other change in that directory.

All work is API-side plus one docs line; no shared/ui or web edits in
this change (the `requireRole` deletion in `packages/shared` belongs to
`remove-dead-modules`).

## 1. API — middleware builder consolidation (D1, D2)

- [x] 1.1 Test-first pins, green against the UNREFACTORED code. In
      `apps/api/src/infrastructure/trpc/trpc.middleware.test.ts` add a
      chain-composition pin test: each of the 7 protected builders
      (`protectedProcedure`, `headProcedure`, `leadProcedure`,
      `viewerProcedure`, `anyRoleProcedure`, `adminProcedure`,
      `leadershipProcedure`) carries exactly 5 middlewares (read
      `_def.middlewares` off a `.query(() => undefined)` instance and
      drop the trailing resolver, as `role-coverage.test.ts` does);
      slots 0-1 are reference-equal to `publicProcedure`'s two
      middlewares; slots 3-4 (`pdfExportGuard`,
      `mutationAuditMiddleware`) are reference-equal across all 7
      builders (compare builders against each other — the unexported
      middlewares need no new export). In
      `apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts`
      add `leadershipProcedure` to the import block (lines 4-10) and a
      `LEADERSHIP_CHAIN` entry to `ALLOWED_CHAINS` (line 76), mirroring
      the existing 7 entries. Run
      `pnpm test --filter @customreport/api` — both must pass BEFORE
      task 1.2 starts.
- [x] 1.2 In `apps/api/src/infrastructure/trpc/trpc.middleware.ts` add
      a local (unexported) factory
      `buildProtectedProcedure(authMiddleware)` returning the explicit
      standalone chain
      `t.procedure.use(metricsMiddleware).use(loggingMiddleware).use(authMiddleware).use(pdfExportGuard).use(mutationAuditMiddleware)`
      — NOT derived from `publicProcedure` (D1). Redefine
      `protectedProcedure = buildProtectedProcedure(isAuthed)` (lines
      412-417) and the 6 role builders (lines 485-525) as
      `buildProtectedProcedure(<existing role middleware const>)`.
      Keep `publicProcedure` (line 338) as its 2-middleware chain; keep
      all 8 export names and every middleware constant untouched (D2).
      Parameter type: try `typeof isAuthed`; if it fails to unify with
      `buildRoleMiddleware(...)` results under tRPC 11 inference, fall
      back to an explicit `MiddlewareBuilder` annotation verified
      against current tRPC 11 docs via Context7. Do not touch
      `buildRoleMiddleware` (its deny branch emits the `roleDenied`
      audit event; `__tests__/audit-events.test.ts` pins it). Pin test,
      gate test, and all existing behavioral tests stay green with zero
      assertion edits.

## 2. API — session hydration (D3, D4, D5)

- [x] 2.1 Test hygiene (D5): in
      `apps/api/src/infrastructure/trpc/trpc.context.test.ts` add
      `clearOrgCache` to the existing `./trpc.context` import (line 6)
      and call `clearOrgCache()` inside the `beforeEach` at line 67.
      Two lines. (Module-level `orgCache`, `trpc.context.ts:38-46`, has
      a 5s TTL that outlives the file run; without the reset the first
      session-bearing case warms it and the 2.2 assertions become
      order-dependent.)
- [x] 2.2 Test-first pins, green against the UNREFACTORED code: in
      `trpc.context.test.ts` dev-session flag-matrix cases assert
      `ctx.session?.organization` deep-equals the stub
      `{ shortName: "PEO", fullName: "Product Engineering & Operations" }`
      (stub values at lines 34-35); optionally add one case where the
      `reportSection.findFirst` stub returns a row and the dev session
      resolves `activeReportSectionId` to it. In
      `apps/api/src/infrastructure/trpc/trpc.context.pdf-export.test.ts`
      assert the same organization stub on the "regular session JWT
      still verifies via the session path FIRST" test (line 174), and
      assert `ctx.session?.organization` is `undefined` on the
      valid-PDF-JWT synthetic-session test (pins the intentional Phase
      32-B1 no-hydration design). All existing cases stay green
      unmodified. Run `pnpm test --filter @customreport/api`.
- [x] 2.3 In `apps/api/src/infrastructure/trpc/trpc.context.ts` add a
      file-local (NOT exported) `async function hydrateSession(session:
UserSession, prisma: PrismaService): Promise<UserSession>`
      composing the four existing helpers unchanged, in current order:
      `resolveSectionId` → `hydrateViewerGroupAccess` →
      `hydrateReportingGroupName` → `hydrateOrganization`. Replace the
      regular-path block (lines 159-162) keeping the call INSIDE the
      existing `try` (hydration failure must keep degrading to
      PDF-verify then dev/null — D4) and the dev-path block (lines
      219-222) keeping the `{ ...DEV_SESSION }` spread AT THE CALL SITE
      (helpers mutate in place; passing the module constant would
      pollute it across requests — D4). No export, no `HydrationStep`
      enum, no mocking seam (D3); the PDF path, `orgCache`,
      `clearOrgCache`, and the four helpers stay untouched. JSDoc must
      state: "PDF-export synthetic sessions intentionally skip
      hydration (Phase 32-B1; guard middleware + groupScopeFilter own
      that restriction)." Tests from 2.1-2.2 pass unchanged.

## 3. Docs

- [x] 3.1 In `openspec/config.yaml` update the context line "must use
      one of 7 canonical middleware-chain builders" to say 8 (aligns
      with `openspec/specs/role-coverage-gate/spec.md` and code).
      Follow-up candidate recorded here, NOT fixed in this change: the
      role-coverage gate prefix-matches on
      `[metricsMiddleware, loggingMiddleware]`, so it cannot catch a
      reordering or omission after slot 2; rewriting the matching
      semantics (exact chain length) needs its own change.

## 4. Verification

- [x] 4.1 Suite focus: `pnpm test --filter @customreport/api` green —
      `trpc.middleware.test.ts` (incl. new pin),
      `__tests__/role-coverage.test.ts` (8 chains),
      `__tests__/audit-events.test.ts` (unchanged),
      `trpc.context.test.ts`, `trpc.context.pdf-export.test.ts`.
      Result: 77 test files, 893 tests passed (886 pre-change + 7 new).
- [x] 4.2 Full gates, record exact results here:
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
      Typecheck across the workspace is the proof that the web client's
      inferred tRPC types did not shift (D2).
      Result (2026-06-11): typecheck ✓ (5 tasks, 0 errors), lint ✓
      (ESLint no issues), test ✓ (893 passed), build ✓ (5 tasks).

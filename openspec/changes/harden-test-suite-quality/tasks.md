# Tasks

## 1. `apps/api/src/lib/audit-logger.test.ts:32` — cover `audit.mutation()`'s branching

- [ ] 1.1 Add a `describe("audit.mutation")` block asserting: success → `info`
      level with no `reason` in context; failure → `warn` level with
      `reason` included in context; and that the conditional `reason` spread
      is fully absent (not `undefined`-keyed) on the success path
- [ ] 1.2 Confirm the new tests fail if `audit.mutation` is edited to always
      log `info` (temporary local mutation, not committed)

## 2. `apps/api/src/modules/admin/reopen-request-admin.service.test.ts:98,119` — de-vacuous the "skews no metric" tests

- [ ] 2.1 Rebuild the already-processed-conflict test (line 98) with the real
      `AdminPrometheusTelemetry` collaborator (matching the pattern the
      first test in the file already uses), not the NOOP default
- [ ] 2.2 Rebuild the stale-auto-close test (line 119) the same way
- [ ] 2.3 Confirm both tests would fail if `respondReopenRequest` wrongly
      incremented the `approved` counter on these paths (temporary local
      mutation, not committed)

## 3. `apps/api/src/modules/archive/archive.service.test.ts:70` — fix the mock-order tautology

- [ ] 3.1 Confirm (by reading `archive.service.ts` and
      `archive.prisma-repository.ts`) that publish-date ordering is a
      repository-layer concern, not `ArchiveService`'s
- [ ] 3.2 Rewrite the test at line 70 to state only what `ArchiveService`
      actually does — passes through `listArchiveReports` in whatever order
      the repository returns, without re-sorting — and rename it away from
      "sorted by latest published first"
- [ ] 3.3 Add (or confirm existing) an order-asserting test at the
      repository layer, where the `publishedAt`-desc sort actually lives,
      using a fixture with items in non-sorted insertion order

## 4. `apps/api/src/modules/period/__tests__/lifecycle-write-gate.test.ts:143` — close the bare-identifier gate gap

- [ ] 4.1 Locate `isReportDelegate` in the lifecycle-write-gate lint/check
      module and extend its detection to also match a bare `Identifier`
      named `report` (or whatever destructured name the codebase uses for
      the report delegate), not only a `PropertyAccessExpression` ending in
      `.report`
- [ ] 4.2 Add a fixture case reproducing `period-creator.scheduler.ts`'s
      `flipDueScheduledToOpen` call shape (`report.updateMany(...)` via a
      destructured/aliased identifier) and assert the gate flags it
- [ ] 4.3 Run the gate against the current repo and confirm
      `flipDueScheduledToOpen`'s existing call is either already compliant
      or gets a documented exemption — it must not silently start failing
      CI without a fix

## 5. `apps/api/src/modules/reminders/reminders.service.test.ts:332` — stop testing a copy of the guard

- [ ] 5.1 Identify the real `dispatchPending` guard in the tRPC router (or
      the shared function it delegates to) and export it if not already
      exported
- [ ] 5.2 Replace `simulateDispatchPending` and its three dependent tests
      with calls through the real guard/procedure, keeping the same
      three cases (allowed, rate-limited/guarded, and whichever third case
      the current suite covers)
- [ ] 5.3 Delete `simulateDispatchPending` once no test references it

## 6. `apps/web/src/features/review/ui/section-verdict-control.test.tsx:45` — cover `resolveBadge`'s decision ladder

- [ ] 6.1 Add a test for the `isCurrent` filter (a stale/non-current verdict
      does not drive the badge)
- [ ] 6.2 Add a test proving `changes_requested` outranks `approved` when
      both are present among current verdicts
- [ ] 6.3 Add a test for the awaiting-vs-none case (no verdicts at all vs.
      an explicit awaiting state)

## 7. `apps/web/src/features/slides/model/slide-grid-cells.test.ts:201` — remove the tautological `toEqual([])`

- [ ] 7.1 Confirm the locally-declared `foreign` array at line 189 is never
      passed to `collectCells`
- [ ] 7.2 Either delete the assertion or rewrite it to assert on
      `collectCells`'s actual foreign-content return value for a fixture
      that does exercise the foreign-content path

## 8. `apps/web/src/lib/client-logger.test.ts:25` — cover the untested surface

- [ ] 8.1 Add a test for count-triggered flush at `FLUSH_AT_COUNT`
- [ ] 8.2 Add a test for `MAX_QUEUE` drop behavior (oldest-dropped or
      newest-rejected, whichever the implementation does)
- [ ] 8.3 Add tests for `window` `error` and `unhandledrejection` capture
- [ ] 8.4 Add a test for `visibilitychange`-triggered flush
- [ ] 8.5 Add a test for the forwarding-disabled no-op path (no network call
      when forwarding is off)
- [ ] 8.6 Add tests for `safeStringify` (circular reference, non-serializable
      value)

## 9. `e2e/integration/cross-role-lifecycle.integration.spec.ts:68,99,129` — replace self-written-value tautologies with real UI assertions

- [ ] 9.1 Line 68 ("lead sees locked"): after navigating the lead page, add
      an assertion on the actual locked-state UI affordance (disabled
      controls, a locked banner/badge — whatever the lead surface renders
      for a published/locked report), in addition to (or instead of) the
      `report.status === "published"` check the test itself set up
- [ ] 9.2 Line 99 ("head publishes → lead UI updates on next navigation"):
      after the reload, assert the lead page actually reflects the new
      published state (content/label change), not only the DB status value
      written on lines 84-91
- [ ] 9.3 Line 129 ("head revokes → lead can edit again"): assert the lead's
      edit affordance is actually present/enabled after the revoke, not only
      `report.status === "draft"` written on lines 116-119

## 10. `e2e/integration/head-journey.integration.spec.ts:115` — fix the dead route and add a render assertion

- [ ] 10.1 Change `goto("/dashboard")` to the real route (`/head/dashboard`)
- [ ] 10.2 Add a render assertion (e.g. a heading or portfolio-card locator)
      so the test fails if the portfolio page 404s or fails to render, not
      only when the seed-derived DB count is wrong

## 11. `e2e/integration/status-risk-sync.integration.spec.ts:215` — remove the read-after-write race

- [ ] 11.1 After the "Save Risk" click, wait for the save request/response
      (`waitForResponse` or an equivalent settled-state UI signal) before
      reading the risk count
- [ ] 11.2 Confirm the `before + 1` assertion would now reliably fail against
      a deliberately-introduced double-write (temporary local mutation, not
      committed)

## 12. Gates

- [ ] 12.1 `pnpm --filter @customreport/api db:generate`
- [ ] 12.2 `pnpm --filter @customreport/api exec vitest run src/lib/audit-logger.test.ts src/modules/admin/reopen-request-admin.service.test.ts src/modules/archive/archive.service.test.ts src/modules/period/__tests__/lifecycle-write-gate.test.ts src/modules/reminders/reminders.service.test.ts`
- [ ] 12.3 `cd apps/web && pnpm exec vitest run src/features/review/ui/section-verdict-control.test.tsx src/features/slides/model/slide-grid-cells.test.ts src/lib/client-logger.test.ts`
- [ ] 12.4 `pnpm typecheck`
- [ ] 12.5 `pnpm lint`
- [ ] 12.6 `pnpm test`
- [ ] 12.7 `pnpm test:e2e:integration`
- [ ] 12.8 `openspec validate harden-test-suite-quality --strict`

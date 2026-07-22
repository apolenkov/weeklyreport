## Why

The 2026-07-22 mass review (Opus batch review + adversarial verification,
council-ratified — `~/work/customreport-archive/2026-07-22-mass-review/`)
confirmed 14 test-quality defects across `apps/api`, `apps/web`, and `e2e/`:
vacuous telemetry assertions that cannot fail even if the counter is wrongly
incremented, a tautological mock-order assertion, un-exercised core
branching in three files, a gate's detection regex missing a call shape the
codebase actually uses, an in-test reimplementation of production guard
logic, and four e2e specs that either assert only values they themselves
wrote, navigate to a non-existent route, or read a mutation result before it
can be guaranteed to have landed. Every one of these lets a real regression
in the covered code ship green. All 14 are Opus-confirmed; the Codex council
pass found zero false positives and zero misses in this group (its one false
positive and five misses both belong to other backlog groups — see
`codex-council.out`).

This is the **test-quality-only** slice of the 2026-07-22 review. Product
defects (period reopen leaks, Fill From TOCTOU, archive floor inversion,
portfolio snapshot miscounts, admin restore reactivation, and other
UI/authz/dead-surface findings) are filed as separate changes; see sibling
groups in `final-backlog.json`.

## What Changes

- `apps/api/src/lib/audit-logger.test.ts` — add coverage for `audit.mutation()`,
  the only method with real branching (success→info vs fail→warn, and the
  conditional `reason` spread).
- `apps/api/src/modules/admin/reopen-request-admin.service.test.ts` — two
  "skews no metric" tests build the service with no telemetry (NOOP), so the
  counter physically cannot move; rebuild both with the real
  `AdminPrometheusTelemetry` (as the first test in the file already does) so
  the assertion can fail if the service starts incrementing wrongly.
- `apps/api/src/modules/archive/archive.service.test.ts` — the "sorted by
  latest published first" test asserts the mock's hardcoded item order; the
  service performs no ordering (sorting lives in the repository). Either
  move/duplicate an order-asserting test to the repository layer that
  actually sorts, or rewrite this test's title and assertions to state only
  what `ArchiveService` does (pass through repository order unchanged).
- `apps/api/src/modules/period/__tests__/lifecycle-write-gate.test.ts` —
  `isReportDelegate` requires a `PropertyAccessExpression` ending in
  `.report`; a delegate reached via a bare destructured identifier (exactly
  how `period-creator.scheduler.ts`'s `flipDueScheduledToOpen` calls
  `report.updateMany(...)`) escapes the gate. Extend `isReportDelegate` to
  also recognize a bare `Identifier` named `report`/`reportDelegate` (or the
  actual destructured name), and add a fixture case proving the scheduler's
  call shape is caught.
- `apps/api/src/modules/reminders/reminders.service.test.ts` — `simulateDispatchPending`
  reimplements the tRPC router's `dispatchPending` guard inline; the three
  tests built on it cannot catch a regression in the real guard. Replace the
  simulation with a call through the actual router procedure (or the shared
  guard function it delegates to, extracted if not already exported).
- `apps/web/src/features/review/ui/section-verdict-control.test.tsx` — add
  direct tests for `resolveBadge`'s decision ladder: the `isCurrent` filter,
  `changes_requested` outranking `approved`, and the awaiting-vs-none case.
- `apps/web/src/features/slides/model/slide-grid-cells.test.ts` — the
  `expect(foreign).toEqual([])` assertion checks a locally-declared array
  never passed to `collectCells`; delete the tautology or rewrite it to
  assert on `collectCells`'s actual foreign-content output.
- `apps/web/src/lib/client-logger.test.ts` — add coverage for the untested
  surface: count-triggered flush (`FLUSH_AT_COUNT`), `MAX_QUEUE` drop,
  window `error`/`unhandledrejection` capture, `visibilitychange` flush, the
  forwarding-disabled no-op path, and `safeStringify`.
- `e2e/integration/cross-role-lifecycle.integration.spec.ts` — three tests
  (lines 68, 99, 129) assert only a `report.status` value the test itself
  wrote moments earlier via direct DB/API setup, never the UI state the
  title claims ("lead sees locked", "lead UI updates", "lead can edit
  again"). Add real UI assertions (locked-state affordance, updated content
  after reload, editable controls) alongside the existing status checks.
- `e2e/integration/head-journey.integration.spec.ts` — `goto("/dashboard")`
  targets a route that does not exist (only `/head/dashboard` does); the
  test's only assertion is a seed-derived DB count, so it passes even if the
  portfolio page 404s. Fix the URL and add a render assertion (e.g. a
  heading or portfolio-card locator) so a broken route fails the test.
- `e2e/integration/status-risk-sync.integration.spec.ts` — after the "Save
  Risk" click, the risk count is read synchronously with no
  `waitForResponse`/poll, so a genuine double-write on edit is not reliably
  caught (the assertion `before + 1` is also the pre-write value on a race).
  Add a wait for the save request/response (or an equivalent UI
  settled-state signal) before reading the count.

## Non-goals

- No production behavior changes beyond the two items above that are
  themselves the confirmed defect being test-hardened
  (`lifecycle-write-gate.ts`'s `isReportDelegate` detection, which is
  tooling/lint code, not runtime product code). Every other item in this
  change is test-file-only.
- Not re-auditing test quality outside these 14 confirmed findings — this
  change does not attempt a fresh sweep of `apps/api`/`apps/web`/`e2e`.
- Not touching the prior `sweep-runtime-correctness` scenarios already
  archived under `fix-vacuous-tests-api`/`fix-vacuous-tests-web` — this
  change only adds new scenarios for patterns not already covered (vacuous
  telemetry NOOP collaborators, in-test guard reimplementation, e2e
  self-written-value tautologies, and unreachable AST/gate call shapes).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `sweep-runtime-correctness` — extends the existing "tests must be able to
  fail for the behavior they name" correctness bar with four new patterns
  confirmed in this review: a telemetry/counter assertion built on a no-op
  collaborator, a test that reimplements the guard logic it claims to
  verify instead of calling through to it, an e2e/integration spec whose
  only assertion is a value the test itself wrote in setup, and a
  string/AST-based detection gate whose pattern misses a call shape the
  codebase actually uses.

## Impact

- `apps/api/src/lib/audit-logger.test.ts`
- `apps/api/src/modules/admin/reopen-request-admin.service.test.ts`
- `apps/api/src/modules/archive/archive.service.test.ts`
- `apps/api/src/modules/period/lifecycle-write-gate.ts` (or wherever
  `isReportDelegate` lives) + its `__tests__/lifecycle-write-gate.test.ts`
- `apps/api/src/modules/reminders/reminders.service.test.ts`
- `apps/web/src/features/review/ui/section-verdict-control.test.tsx`
- `apps/web/src/features/slides/model/slide-grid-cells.test.ts`
- `apps/web/src/lib/client-logger.test.ts`
- `e2e/integration/cross-role-lifecycle.integration.spec.ts`
- `e2e/integration/head-journey.integration.spec.ts`
- `e2e/integration/status-risk-sync.integration.spec.ts`

## Verification

Test-quality-only bar: scoped unit suites for every touched file plus the
full gate, since one item touches shared lint/gate tooling.

- `pnpm --filter @customreport/api db:generate`
- `pnpm --filter @customreport/api exec vitest run src/lib/audit-logger.test.ts src/modules/admin/reopen-request-admin.service.test.ts src/modules/archive/archive.service.test.ts src/modules/period/__tests__/lifecycle-write-gate.test.ts src/modules/reminders/reminders.service.test.ts`
- `cd apps/web && pnpm exec vitest run src/features/review/ui/section-verdict-control.test.tsx src/features/slides/model/slide-grid-cells.test.ts src/lib/client-logger.test.ts`
- `pnpm typecheck && pnpm lint && pnpm test`
- `pnpm test:e2e:integration` (covers the three rewritten e2e specs; needs
  `E2E_DATABASE_URL`)
- `openspec validate harden-test-suite-quality --strict`

## Sequencing

Independent of the product-defect changes in this review batch (period
reopen leak, Fill From TOCTOU, archive floor, portfolio snapshot, admin
restore) — no shared files, lowest severity, can land in any order relative
to them.

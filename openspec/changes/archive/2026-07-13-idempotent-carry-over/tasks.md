## 1. Race-safe existing-execution branch

- [ ] 1.1 In `carry-over.service.ts`, export `isTargetEditable` (currently a
      private module function) so `carry-over.prisma-repository.ts` can call
      the exact same rule inside its transaction, instead of duplicating it
- [ ] 1.2 In `carry-over.prisma-repository.ts`'s `saveCarryOver`, when
      `tx.carryOverExecution.findFirst` finds an `existing` row for the
      `(sourceReportId, targetReportId)` pair: skip
      `tx.carryOverRecord.createMany` entirely (it currently still runs
      keyed on the caller's phantom, never-inserted `execution.id` and
      throws P2003)
- [ ] 1.3 In that same branch, re-read the existing execution's own records
      with `tx.carryOverRecord.findMany({ where: { executionId: existing.id
} } })` and build the returned `CarryOverResult` from `existing` +
      those records, not from the caller's `execution`/`records` arguments
- [ ] 1.4 Keep `persistCarriedRowsForSection` running for every target
      section on both branches (new-execution and existing-execution) — it
      is already idempotent via `skipDuplicates` and the service's upstream
      lineage filtering, so re-running it on the existing-execution branch
      does not duplicate rows

## 2. In-transaction editability re-check (TOCTOU close)

- [ ] 2.1 At the top of the `saveCarryOver` transaction, before any write,
      re-read the target report's `periodStatus`/`archived` via
      `tx.report.findUnique({ where: { id: execution.targetReportId },
select: { periodStatus: true, archived: true } })`
- [ ] 2.2 Apply `isTargetEditable` (from task 1.1) to that freshly-read
      state; if it is no longer editable, throw `CarryOverConflictError`
      (reuse the existing error class) and let the transaction roll back —
      do not write `carryOverExecution`, `carryOverRecord`, or any carried
      item/decision row
- [ ] 2.3 Confirm the outer catch in `saveCarryOver` (the `isUniqueViolation`
      branch) is unaffected: the new re-check throws a distinct error type,
      so it propagates past that catch unchanged

## 3. Tests

- [ ] 3.1 Add a repository-level test that simulates the race: pre-insert a
      `carryOverExecution` + its records for `(sourceReportId,
targetReportId)` directly via Prisma, then call `saveCarryOver` with a
      different phantom `execution.id`/`records`; assert it returns the
      pre-inserted execution's records (not the phantom ones) and does not
      throw
- [ ] 3.2 Add a test that flips the target report's `periodStatus` to
      `published` (or sets `archived: true`) between constructing the
      `saveCarryOver` call and its execution, and asserts the transaction
      throws `CarryOverConflictError` and leaves no new
      `carryOverExecution`/`carryOverRecord`/carried item or decision rows
      behind
- [ ] 3.3 Confirm the existing dedupe-key race test (P2002 branch via
      `isUniqueViolation`) still passes unchanged

## 4. Spec delta

- [ ] 4.1 `carry-over-automation`: ADD a requirement that concurrent carry-over
      executions for the same source/target resolve to one race-safe write —
      the losing transaction returns the winner's recorded rows instead of
      inserting against an uncommitted execution id — and that target
      editability is re-validated inside the write transaction, not only
      before it opens

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `pnpm test:integration` (single-thread, shared DB — see repo
      integration-gate convention)
- [ ] 5.4 `openspec validate idempotent-carry-over --strict`
- [ ] 5.5 Adversarial review of the diff (two independent reviewers) before
      archiving

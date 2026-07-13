## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`CarryOverPrismaRepository.saveCarryOver`'s existing-execution guard is
half-implemented. When a concurrent carry-over already committed between the
service's pre-transaction dedupe read and the transaction's own `findFirst`,
the losing transaction correctly skips `carryOverExecution.create` — but then
still runs `carryOverRecord.createMany` keyed on `execution.id`, an id that
was never inserted. That insert violates the `CarryOverRecord.executionId`
foreign key and throws a raw P2003, because `isUniqueViolation` only matches
P2002. Phase A verification found the practical blast radius narrower than
first reported: both racers materialize identical carried rows from the same
source sections, so nothing is silently lost, and every production trigger
routes through `carryOverIntoOpenedPeriod`, which swallows the error as a
warn log — no user-facing 500. What remains genuinely wrong: the loser
should resolve to the winner's already-recorded execution and records
instead of attempting a doomed insert, and the period-editability guard is
read once before the transaction opens and never re-checked inside it,
leaving a small window to write into a period that was published or
archived in between.

## What Changes

- `apps/api/src/modules/carry-over/carry-over.prisma-repository.ts`:
  `saveCarryOver`'s in-transaction existing-execution branch no longer
  attempts `carryOverRecord.createMany` against the phantom `execution.id`.
  When `tx.carryOverExecution.findFirst` finds a row already committed for
  the `(sourceReportId, targetReportId)` pair, the transaction re-reads that
  row's own records (`tx.carryOverRecord.findMany({ where: { executionId:
existing.id } } })`) and the method returns those instead of the caller's
  phantom-keyed `execution`/`records` arguments. `persistCarriedRowsForSection`
  still runs for every target section (already idempotent via
  `skipDuplicates` and the service's lineage filtering), so no carried row
  is skipped by this change.
- Same file: before writing, the transaction re-reads the target report's
  `periodStatus`/`archived` and re-applies the editability rule
  (`isTargetEditable`, exported from `carry-over.service.ts` for reuse)
  inside the transaction, aborting with `CarryOverConflictError` if the
  target stopped being editable after the service's pre-transaction check.
  This closes the TOCTOU window between that read and the commit.
- `apps/api/src/modules/carry-over/carry-over.service.ts`: exports
  `isTargetEditable` so the repository can reuse the exact same rule instead
  of duplicating it.
- No schema change, no new table/column — this only tightens the existing
  write transaction's control flow.

## Impact

- `apps/api/src/modules/carry-over/carry-over.prisma-repository.ts`
- `apps/api/src/modules/carry-over/carry-over.service.ts`
- `apps/api/src/modules/carry-over/carry-over.prisma-repository.test.ts` (or
  equivalent existing test file — add race-branch coverage)

Non-goals: no change to `carry-over-row-writes.ts` (already idempotent, per
Phase A evidence); no change to the once-per-`(sourceReportId,
targetReportId)` dedupe design; no change to `auto-carry-over.ts`'s
error-swallowing (still correct — carry-over failures must not block login).

## 1. Reopen compare-and-set helper

- [ ] 1.1 Add `apps/api/src/lib/reopen-compare-and-set.ts` mirroring
      `publish-compare-and-set.ts`: a structural `ReopenCasClient` interface
      (`report` picked to `updateMany` | `findUnique`), a `ReopenCasOutcome`
      union, and an async `reopenCompareAndSet(client, reportId, data)`
- [ ] 1.2 The guarded predicate is
      `{ id, archived: false, periodStatus: "published" }`; document in the
      helper that `archived: false` plus `periodStatus: "published"` is the
      single point that closes the reopen-versus-archive race
- [ ] 1.3 On `count === 1` return `transitioned`; on `count === 0` return a
      fail-closed outcome (never a silent success) so the caller can raise a
      domain error — a raced archive or a no-longer-published row must not be
      treated as a completed reopen
- [ ] 1.4 The helper owns only the predicate and the zero-row classification;
      the client (transaction or base) and the caller's full `data` field set
      are injected, exactly as in the publish helper

## 2. Route reopen through the compare-and-set

- [ ] 2.1 `apps/api/src/modules/period/infrastructure/period.prisma-repository.ts`:
      in `reopenPeriod`, replace the `applyTransition(tx, reportId, "reopen", …)`
      call with `reopenCompareAndSet(tx, reportId, buildTransition("reopen", { now: new Date() }))`
- [ ] 2.2 Gate the `tx.reportSection.updateMany` draft-reset on the
      compare-and-set having returned `transitioned`; when it did not, raise a
      fail-closed domain error and reset no sections
- [ ] 2.3 Preserve the existing `isOpenBoundaryConflict` →
      `AdminPeriodOverlapError` catch so a boundary collision still surfaces as
      `BAD_REQUEST`, never a 500

## 3. Guard admin manual archive

- [ ] 3.1 `apps/api/src/modules/admin/admin-period-lifecycle.ts::archivePeriod`:
      replace the unconditional `prisma.report.update({ where: { id } })` with a
      guarded `report.updateMany({ where: { id: periodId, archived: false }, data: buildTransition("archive", {}) })`
- [ ] 3.2 Treat a `count === 0` match as a fail-closed already-archived domain
      error rather than a silent no-op, so the manual archive write is no longer
      unconditional
- [ ] 3.3 `apps/api/src/modules/admin/period-admin.service.ts::archivePeriod`:
      surface the already-archived outcome as the appropriate domain error to
      the caller

## 4. Concurrency integration test

- [ ] 4.1 Add
      `apps/api/src/modules/period/infrastructure/period.reopen-atomicity.integration.test.ts`
      alongside the publish-atomicity test, using the same real-Postgres harness
- [ ] 4.2 Drive a reopen and an archive concurrently on one published report and
      assert the committed row is never editable-archived
      (`archived=true` with `periodState="open"`) and never an archived period
      whose sections were reset to draft
- [ ] 4.3 Assert exactly one of the two writers wins and the loser fails closed
      (raises its domain error, mutates nothing)

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `pnpm test:integration` — the new reopen-atomicity test passes against real Postgres
- [ ] 5.4 `npx openspec validate guard-period-reopen-cas --strict`
- [ ] 5.5 Adversarial review of the diff (two independent reviewers) before archiving

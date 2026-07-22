# Tasks

## 1. Pin current (broken) behavior

- [ ] 1.1 Add a characterization/regression integration test in
      `apps/api/src/modules/report-sections/infrastructure/fill-from.integration.test.ts`
      (or `lead-form.prisma-repository.integration.test.ts`): start a
      `fillFromSection` call, and — inside the window between the target
      section's read and its transaction's CAS — commit a publish of the
      target's report; assert the current code lets the fill proceed and
      overwrites the now-published period's live `Item`/`Risk`/`Decision`
      rows (pins
      `apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts:361`).
      Use the same paused-transaction / explicit two-phase control technique
      `record-comment-save-coordination`'s concurrency tests used.

## 2. Fix fillFromSection's transaction

- [ ] 2.1 In `fillFromSection`
      (`apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts:356-409`),
      add a raw `SELECT "periodStatus" FROM "Report" WHERE "id" = <targetReportId>
  FOR UPDATE` query as the FIRST statement inside the `$transaction`
      callback — the same lock `saveSection` takes
      (`report-sections.prisma-repository.ts:128-130`). This requires
      threading the target section's `reportId` into `fillFromSection` (or
      resolving it from the target-section read already available to the
      caller).
- [ ] 2.2 Reject with the existing `LeadFormConstraintError` ("Cannot fill a
      section of a published report.") when the locked row's `periodStatus`
      is not `"open"` or `"reopened"`, BEFORE the target-section version CAS
      — mirroring `saveSection`'s ordering (lock check, then CAS, then
      delete-recreate).
- [ ] 2.3 Re-run the test from Task 1 and confirm it now fails closed: the
      publish wins the race, the fill observes `"published"` under the lock,
      and the target's live rows are left untouched.
- [ ] 2.4 Add a second, non-race case: `fillFromSection` called directly
      against an already-published target (bypassing the service precheck)
      returns the typed error and performs zero writes.

## 3. Confirm no regression on existing Fill From behavior

- [ ] 3.1 Re-run `fill-from.derive.test.ts` and the existing
      `fill-from.integration.test.ts` cases (open/reopened targets, XOR
      activity-parent carry rules, version-conflict CAS) to confirm the new
      lock does not change any currently-passing scenario.

## 4. Spec delta

- [ ] 4.1 `fill-from-write-lock`: ADD the requirement that `fillFromSection`
      locks the parent `Report` row and re-checks `periodStatus` in-tx before
      mutating target-section rows.

## Gates

- [ ] `pnpm --filter @customreport/api db:generate`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `cd apps/api && pnpm test:integration`
- [ ] `openspec validate fix-fillfrom-published-period-write-lock --strict`

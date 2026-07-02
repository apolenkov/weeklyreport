## 1. Scheduler Fix

- [ ] 1.1 In `apps/api/src/modules/period/auto-publisher.scheduler.ts`, add
      `archived: false` to the `findMany` candidate `where` clause (after `status:
"draft"`, mirroring the auto-archiver spelling exactly)
- [ ] 1.2 Close the read-then-write race: scope the auto-publish write
      (`PublicationPrismaRepository.saveAssembledReport` `auto` path, driven by
      `PublicationService.publishAuto`) to a compare-and-set that only writes when
      the row is still `status="draft"` and `archived=false` (e.g. an
      `updateMany`/guarded `where`); a zero-row match means the period was archived
      or already published after selection and is skipped. Do NOT change the manual
      `publishReport` write path
- [ ] 1.3 Make the skip explicit so success side-effects do not fire: have the
      repository auto-path report whether the compare-and-set matched a row, and
      have `PublicationService.publishAuto` return a discriminated result — a
      published outcome carrying the `AssembledReport`, or a skipped outcome with no
      report. Increment the publish metrics
      (`customreportReportsSubmittedTotal`, `customreportPeriodStateTransitionsTotal`)
      and call `enqueueIngestion` ONLY on the published branch. (`AssembledReport`
      has no `archived`/`periodState`, so the skip cannot be inferred from the
      returned report.)
- [ ] 1.4 In `auto-publisher.scheduler.ts`, branch on the `publishAuto` outcome:
      run the missing-section count, the `periodAutoPublish` audit event, and the
      `periodIds` push ONLY for a published outcome; for a skipped outcome do none
      of these and do not log it as an error (skip is an expected no-op, distinct
      from the `catch` failure branch)

## 2. Tests

- [ ] 2.1 In `apps/api/src/modules/period/auto-publisher.scheduler.test.ts`, add
      a candidate-exclusion test that asserts on the `findMany` CALL, not just its
      result: `expect(prisma.report.findMany)` was called with a `where` object
      containing `archived: false` (so the test cannot pass vacuously on an empty
      mock return)
- [ ] 2.2 Add a regression test: an eligible non-archived draft
      (`periodState="open"`, `status="draft"`, `archived=false`) past the cutoff IS
      selected and `publishAuto` IS called for it
- [ ] 2.3 Add a race test for the write guard (against
      `PublicationPrismaRepository` / `publishAuto`): when the row is archived after
      selection, the guarded write affects zero rows and the period stays
      `periodState="archived"`, `archived=true` (never `periodState="published"`)
- [ ] 2.4 Add a skip-side-effects test: when the compare-and-set matches zero rows,
      `publishAuto` returns the skipped outcome and the scheduler emits NO publish
      metric, NO `enqueueIngestion`, NO `periodAutoPublish` audit, NO missing-section
      count, and excludes the id from the returned `periodIds` (assert the spies are
      not called for the skipped period)
- [ ] 2.5 Confirm the existing auto-publisher tests still pass with the new guard
      (`pnpm test --filter @customreport/api -- auto-publisher`)

## 3. Verification

- [ ] 3.1 Run `pnpm typecheck` — no new type errors
- [ ] 3.2 Run `pnpm lint` — no new lint warnings or errors
- [ ] 3.3 Run `pnpm test` — full suite green
- [ ] 3.4 (Optional) Query the dev/UAT database for any existing corrupted rows
      (`archived=true AND periodStatus='published'`) and remediate if any are found

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
- [ ] 2.4 Confirm the existing auto-publisher tests still pass with the new guard
      (`pnpm test --filter @customreport/api -- auto-publisher`)

## 3. Verification

- [ ] 3.1 Run `pnpm typecheck` — no new type errors
- [ ] 3.2 Run `pnpm lint` — no new lint warnings or errors
- [ ] 3.3 Run `pnpm test` — full suite green
- [ ] 3.4 (Optional) Query the dev/UAT database for any existing corrupted rows
      (`archived=true AND periodStatus='published'`) and remediate if any are found

# Tasks

## 1. Characterization pins (current behavior, before the fix)

- [ ] 1.1 Add a unit test on `PublicationService.publishAuto` pinning today's
      behavior: when the fetched report is already `status === "published"`,
      it returns `{ published: true, report }` and `saveAutoPublishedReport`
      is NOT called — pin this before changing the return shape.
- [ ] 1.2 Add a unit test on `AutoPublisherScheduler.runOnce` pinning today's
      (buggy) behavior: given a candidate whose `publishAuto` call resolves
      to the idempotent already-published outcome, the scheduler currently
      still calls `auditLogger.periodAutoPublish` and `logger.log` — pin this
      as the characterization of the bug being fixed, then invert the
      assertion once the fix lands (task 3.2).

## 2. Distinguish the two `published: true` outcomes

- [ ] 2.1 In `apps/api/src/modules/publication/application/publication.service.ts`,
      widen `AutoPublishResult` so the `published: true` case carries a
      discriminant (e.g. `wasAlreadyPublished: boolean`, or a separate
      `alreadyPublished` variant) distinguishing "no write happened, report
      was already published" from "this call performed the write."
- [ ] 2.2 Update the idempotent branch at line 159 (`report.status ===
"published"`) to set the discriminant to "already published."
- [ ] 2.3 Update the real write branch (after `saveAutoPublishedReport`
      succeeds) to set the discriminant to "published now."
- [ ] 2.4 Update the JSDoc above `publishAuto` and on `AutoPublishResult` to
      describe the new discriminant — drop nothing already accurate, extend
      it.

## 3. Suppress the scheduler's audit on the no-write branch

- [ ] 3.1 In `apps/api/src/modules/period/infrastructure/auto-publisher.scheduler.ts`
      (`runOnce`), branch on the new discriminant: when `publishAuto` reports
      "already published, no write," skip the missing-sections count query,
      the `logger.log` line, and `auditLogger.periodAutoPublish` — same
      treatment already given to the `published: false` (archived) branch —
      and do not add the candidate to `publishedIds`.
- [ ] 3.2 Flip the characterization test from task 1.2 into the corrected
      assertion: no audit call, no log line, no missing-sections count query,
      candidate excluded from `publishedIds`.

## 4. Regression coverage for the fix

- [ ] 4.1 Unit test: `PublicationService.publishAuto` real auto-publish path
      (report was `draft`, write succeeds) still returns the "published now"
      discriminant and still emits publish side-effects exactly once.
- [ ] 4.2 Unit test: `AutoPublisherScheduler.runOnce` with a candidate that
      races to already-published — audit, log, and missing-sections count are
      all skipped, and the candidate is excluded from `publishedIds`; a
      second candidate in the same batch that genuinely auto-publishes is
      unaffected (still audited, still counted).
- [ ] 4.3 Confirm the existing `published: false` (archived-after-selection)
      branch and its tests are untouched by the discriminant addition.

## Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm --filter @customreport/api test:integration`

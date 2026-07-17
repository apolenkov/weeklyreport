# Tasks

## 1. Characterization: pin the real BullMQ post-increment sequence

- [ ] 1.1 In `pdf-export.processor.test.ts`, rewrite the "marks the DB export
      job failed only on the terminal attempt" test to call the `failed`
      handler with `attemptsMade=2, attempts=3` first (penultimate, retry
      still pending) and assert `markExportFailed` is NOT called, then with
      `attemptsMade=3, attempts=3` (true terminal) and assert
      `markExportFailed` IS called with the job/error.
- [ ] 1.2 In `email-reminder.processor.test.ts`, rewrite "does not mark sent
      if sendMail throws, and records a failed terminal state on the final
      attempt" to use `attemptsMade=3, attempts=3` as the terminal case.
- [ ] 1.3 In `email-reminder.processor.test.ts`, rewrite "releases the claim
      (not markReminderFailed) when a non-final attempt's dispatch fails" to
      additionally cover `attemptsMade=2, attempts=3` (penultimate, retry
      still pending) alongside the existing `attemptsMade=0` case, asserting
      `releaseExecutionClaim` and never `markReminderFailed` for both.

## 2. Fix the off-by-one in both processors

- [ ] 2.1 `pdf-export.processor.ts` `onJobFailed`: replace
      `attemptsUsed = job.attemptsMade + 1; attemptsUsed >= maxAttempts` with
      `job.attemptsMade >= maxAttempts`.
- [ ] 2.2 `email-reminder.processor.ts` `processJob` catch block: apply the
      same replacement.
- [ ] 2.3 Re-run the task-1 tests and confirm they now pass against the
      fixed code (they must fail against the pre-fix code — check this by
      running them against the current HEAD before applying 2.1/2.2).

## 3. Dispatch-branch coverage the email test never exercised

- [ ] 3.1 Add an `email-reminder.processor.test.ts` case for
      `kind: "deadline"` job data: assert `renderEmail` is called with
      `{ kind: "deadline", props: {...} }` and `sendMailMultipart` is called
      with the rendered subject/html/text.
- [ ] 3.2 Add a matching case for `kind: "escalation"` job data, asserting
      the equivalent `renderEmail`/`sendMailMultipart` calls.
- [ ] 3.3 Extend the test file's `EmailReminderJobData` / `createMockJob`
      helper so it can construct all three payload shapes (legacy,
      `deadline`, `escalation`) instead of only the legacy one.

## Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm --filter @customreport/api test:integration`

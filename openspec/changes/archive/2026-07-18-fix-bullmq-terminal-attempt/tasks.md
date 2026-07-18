# Tasks

## 1. Characterization: pin the real BullMQ post-increment sequence

- [x] 1.1 In `pdf-export.processor.test.ts`, rewrite the "marks the DB export
      job failed only on the terminal attempt" test to call the `failed`
      handler with `attemptsMade=2, attempts=3` first (penultimate, retry
      still pending) and assert `markExportFailed` is NOT called, then with
      `attemptsMade=3, attempts=3` (true terminal) and assert
      `markExportFailed` IS called with the job/error.
- [x] 1.2 In `email-reminder.processor.test.ts`, keep the terminal case on
      the PRE-increment scale: the check runs inside `processJob`'s catch,
      BEFORE BullMQ's `moveToFailed` increments `attemptsMade`, so the true
      final (3rd of 3) attempt reads `attemptsMade=2` there. (CORRECTED
      2026-07-17: the original wording — `attemptsMade=3` as terminal —
      wrongly assumed post-increment semantics at this call site.)
- [x] 1.3 In `email-reminder.processor.test.ts`, cover non-final attempts on
      the same pre-increment scale: `attemptsMade=0` (first) and
      `attemptsMade=1` (penultimate of 3), asserting
      `releaseExecutionClaim` and never `markReminderFailed` for both.

## 2. Fix the off-by-one in both processors

- [x] 2.1 `pdf-export.processor.ts` `onJobFailed`: replace
      `attemptsUsed = job.attemptsMade + 1; attemptsUsed >= maxAttempts` with
      `job.attemptsMade >= maxAttempts` (event handler fires post-increment).
- [x] 2.2 `email-reminder.processor.ts` `processJob` catch block: KEEP the
      `+1` — this observation point is pre-increment; removing it would make
      the terminal branch unreachable (release→reaper→re-enqueue forever).
      Document the two sites' difference in a comment at each check.
      (CORRECTED 2026-07-17; the original task wrongly prescribed the same
      replacement as 2.1.)
- [x] 2.3 Re-run the task-1 tests and confirm they now pass against the
      fixed code (they must fail against the pre-fix code — check this by
      running them against the current HEAD before applying 2.1/2.2).

## 3. Dispatch-branch coverage the email test never exercised

- [x] 3.1 Add an `email-reminder.processor.test.ts` case for
      `kind: "deadline"` job data: assert `renderEmail` is called with
      `{ kind: "deadline", props: {...} }` and `sendMailMultipart` is called
      with the rendered subject/html/text.
- [x] 3.2 Add a matching case for `kind: "escalation"` job data, asserting
      the equivalent `renderEmail`/`sendMailMultipart` calls.
- [x] 3.3 Extend the test file's `EmailReminderJobData` / `createMockJob`
      helper so it can construct all three payload shapes (legacy,
      `deadline`, `escalation`) instead of only the legacy one.

## Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm --filter @customreport/api test:integration`

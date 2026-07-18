## Why

Two confirmed code-review findings on the BullMQ `failed` event handlers:

- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts:78` computes
  `attemptsUsed = job.attemptsMade + 1` and marks the export row failed when
  `attemptsUsed >= maxAttempts`. BullMQ increments `job.attemptsMade` before
  emitting the Worker `failed` event (`job.js:555` runs before
  `worker.js:662-663` emits), so for `attempts: 3` the handler sees
  `attemptsMade` values `1, 2, 3` — not `0, 1, 2`. At `attemptsMade === 2`
  (the second of three attempts, with a third retry still queued),
  `attemptsUsed` is `3 >= 3` and the export is marked `failed` a full attempt
  early, even though the third attempt can still succeed. The DLQ monitor
  (`dlq-monitor.service.ts:132`) already gets this right with
  `job.attemptsMade >= attemptsConfigured` — the two paths disagree on what
  "terminal" means for the same field.
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.test.ts:404` locks
  in the bug: it exercises `attemptsMade=2` (`attempts: 3`) as the "terminal"
  case and `attemptsMade=0` as "non-terminal". Under the real post-increment
  semantics, `attemptsMade=2` is the penultimate attempt (a retry is still
  pending) and the true terminal attempt is `attemptsMade=3`. The test's own
  comment history is why this bug shipped — it asserts the premature-mark
  behavior as correct instead of catching it.

`EmailReminderProcessor` (`email-reminder.processor.ts`) has the same
`attemptsUsed = job.attemptsMade + 1` computation, but its check sits INSIDE
`processJob`'s own catch — which runs BEFORE BullMQ's `moveToFailed`
increments `attemptsMade` (the increment lands only after the processor
throws). At that observation point the counter excludes the failing attempt,
so the `+1` is CORRECT there and must stay; dropping it would make the
terminal branch unreachable and a permanently-failing reminder would cycle
release→reaper-re-enqueue forever. Only the observation-point rationale and
the test's mislabeled fixtures need correcting. Its `EmailReminderJobData`
union also has three
payload shapes (legacy, `kind: "deadline"`, `kind: "escalation"`) but the
test's `createMockJob` helper only ever constructs the legacy shape — the
`dispatchEmail` branches for `deadline` and `escalation` have no test
coverage at all.

## What Changes

- Fix the terminal-attempt check in `pdf-export.processor.ts`'s `onJobFailed`
  from `job.attemptsMade + 1 >= maxAttempts` to `job.attemptsMade >=
maxAttempts`, matching `dlq-monitor.service.ts`.
- Keep the `+1` in `email-reminder.processor.ts`'s `processJob` catch block
  (pre-increment observation point) and document WHY the two processors
  legitimately differ; fix its tests' attempt-count fixtures to the
  pre-increment scale (terminal = `attemptsMade=2` of `attempts=3` inside
  the catch).
- Rewrite the `pdf-export.processor.test.ts` terminal-attempt test to use the
  real post-increment sequence: `attemptsMade=2` of `attempts=3` as the
  genuine non-terminal (penultimate, retry still pending) case, and
  `attemptsMade=3` as the genuine terminal case.
- Rewrite the two `email-reminder.processor.test.ts` tests that assert
  `attemptsMade=2`/`attempts=3` is terminal, to the same corrected sequence
  (penultimate at `attemptsMade=2`, terminal at `attemptsMade=3`).
- Add `email-reminder.processor.test.ts` coverage for the `dispatchEmail`
  branches the current test never exercises: `kind: "deadline"` and
  `kind: "escalation"` payloads, asserting the correct `renderEmail` call and
  `sendMailMultipart` invocation for each.

## Capabilities

### Modified Capabilities

- `pdf-export-integrity` — the worker's terminal-attempt check for marking a
  PDF export job failed now matches BullMQ's actual post-increment
  `attemptsMade` semantics instead of firing one attempt early.

## Impact

- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts` —
  terminal-attempt check fix.
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.test.ts` —
  characterization test rewritten to the real attempt sequence.
- `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts` —
  identical terminal-attempt check fix.
- `apps/api/src/infrastructure/bullmq/email-reminder.processor.test.ts` —
  two tests rewritten to the real attempt sequence, plus new coverage for the
  `deadline`/`escalation` dispatch branches.
- Package: `@customreport/api` only. No schema, migration, or web change.

## Non-goals

- Not touching `dlq-monitor.service.ts` — its check is already correct and
  is the reference this change aligns the two processors to.
- Not changing the configured `attempts` count or backoff strategy for
  either queue.
- Not adding new BullMQ events, retry policies, or a shared helper to
  de-duplicate the terminal-attempt check across the three call sites —
  each already reads `job.attemptsMade` directly and a shared helper is not
  required to fix the bug.
- Not exercising the legacy (kind-absent) `dispatchEmail` branch — it already
  has coverage in the existing test suite.

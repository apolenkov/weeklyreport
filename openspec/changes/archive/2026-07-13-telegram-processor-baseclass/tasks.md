## 1. Extend `RawBullMqProcessor`

- [ ] 1.1 `telegram.queue.ts`: change `TelegramProcessor` to
      `extends RawBullMqProcessor<TelegramOutboundJobData>`; constructor
      keeps its existing parameter order (`adapter`, `env`, `logger?`,
      `cls?`) and calls `super(env, logger, cls)`
- [ ] 1.2 Add the three required protected members: `queueName =
TELEGRAM_OUTBOUND_QUEUE_NAME`, `spanName = "telegram-outbound.process"`,
      and keep `processJob` as-is (already matches the base's
      `protected abstract processJob(job: Job<TData>): Promise<void>` shape)
- [ ] 1.3 Rename the existing `logFailure` method to `onJobFailed` (matching
      the base's abstract signature) and keep its body unchanged
- [ ] 1.4 Delete the hand-rolled `onModuleInit`, `onModuleDestroy`, and the
      `new Worker(...)` / `.on("failed", ...)` wiring — the base class now
      owns the worker lifecycle
- [ ] 1.5 Move the `concurrency: 2` option into a
      `protected override extraWorkerOptions(): Partial<WorkerOptions>`
      override, mirroring `EmailReminderProcessor`'s rate-limiter override;
      keep the existing comment explaining the `2` value
- [ ] 1.6 Update the file-header comment block: it currently documents "raw
      `new Worker(...)` on OnModuleInit, not @Processor" as this processor's
      own workaround — rephrase to describe the shared `RawBullMqProcessor`
      base (which already carries that rationale) instead of restating it
      per-file

## 2. De-duplicate the job-options constant

- [ ] 2.1 `trpc.router.ts`'s `admin.testTelegramSend`: import
      `TELEGRAM_OUTBOUND_JOB_OPTS` from `../../modules/telegram/telegram.queue.js`
      and spread it as the fourth argument to `deps.telegramOutboundQueue.add(...)`
      instead of the inline `{ attempts: 3, backoff: {...}, removeOnComplete,
removeOnFail }` literal
- [ ] 2.2 Confirm the spread produces the identical object shape BullMQ
      expects (no extra/missing keys) — the literal and the constant are
      already numerically identical, so this is a pure de-duplication

## 3. Update the existing unit test to the new shape

- [ ] 3.1 `telegram.queue.test.ts`'s `TestProcessor` subclass: update the
      `processJob` shim cast (still calls the now-`protected` `processJob`,
      no behavior change needed there) and rename `logFailureForTest`'s
      internal cast/call from `logFailure` to `onJobFailed`
- [ ] 3.2 Re-run the full existing test file unchanged in assertions — only
      the internal method name referenced through the cast changes; every
      `expect(...)` stays as-is

## 4. Spec delta

- [ ] 4.1 `queue-worker-architecture`: ADD a requirement that every BullMQ
      worker processor extends `RawBullMqProcessor` rather than constructing
      its own `Worker` instance

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `grep -rn "new Worker(" apps/api/src/modules apps/api/src/infrastructure/bullmq` — the only remaining `new Worker(...)` call in the codebase is inside `raw-bullmq-processor.ts` itself
- [ ] 5.4 Live-check: run the admin `testTelegramSend` smoke test against the
      seeded `MockTelegramAdapter` and confirm the job is picked up and
      logged identically to before the change
- [ ] 5.5 `openspec validate telegram-processor-baseclass --strict`

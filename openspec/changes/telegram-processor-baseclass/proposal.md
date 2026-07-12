## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`TelegramProcessor` (`apps/api/src/modules/telegram/telegram.queue.ts`) hand-rolls
`onModuleInit`/`onModuleDestroy`/`new Worker(...)`/`.on("failed")` instead of
extending `RawBullMqProcessor`, the abstract base its two siblings
(`EmailReminderProcessor`, `PdfExportProcessor`) already use. It is the only
`new Worker()` call outside that base class, so a future base-class fix —
e.g. adding a Worker `"error"` listener — silently will not reach Telegram.

Separately, `TELEGRAM_OUTBOUND_JOB_OPTS` exists specifically to keep the
enqueue-time retry policy from drifting, but has zero production consumers:
`trpc.router.ts`'s `admin.testTelegramSend` hard-codes an identical inline
literal (`attempts: 3, backoff: {...}, removeOnComplete, removeOnFail`)
instead of importing the constant, so the anti-drift constant provides no
protection today.

## What Changes

- `apps/api/src/modules/telegram/telegram.queue.ts`: change
  `TelegramProcessor` to `extends RawBullMqProcessor<TelegramOutboundJobData>`,
  supplying `queueName` (`TELEGRAM_OUTBOUND_QUEUE_NAME`), `spanName`
  (`"telegram-outbound.process"`), `processJob`, and `onJobFailed` (the
  existing `logFailure` body); drop the hand-rolled `onModuleInit`,
  `onModuleDestroy`, `new Worker(...)`, and `.on("failed")` wiring — the base
  class now owns all of it. Concurrency (`2`) moves into an
  `extraWorkerOptions()` override, mirroring `EmailReminderProcessor`'s
  rate-limiter override.
- `apps/api/src/infrastructure/trpc/trpc.router.ts`: `admin.testTelegramSend`
  imports and spreads `TELEGRAM_OUTBOUND_JOB_OPTS` from
  `telegram.queue.ts` instead of repeating the inline literal, so the
  constant is the single source of truth for the enqueue-time retry policy.
- No behavior change: retry policy, concurrency, queue name, and failure
  logging all stay numerically identical — this is a structural
  de-duplication, not a policy change.

## Impact

- `apps/api/src/modules/telegram/telegram.queue.ts`
- `apps/api/src/infrastructure/trpc/trpc.router.ts`
- Any existing unit test asserting `TelegramProcessor`'s lifecycle methods
  directly (`onModuleInit`/`onModuleDestroy`) needs to keep asserting through
  the same public surface, now inherited from `RawBullMqProcessor`.

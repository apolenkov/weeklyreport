# queue-worker-architecture

## Purpose

Define the shared conventions for BullMQ worker processors and their job-option defaults.

## Requirements

### Requirement: BullMQ worker processors extend the shared raw-Worker base class

Every in-process BullMQ worker processor MUST extend `RawBullMqProcessor`
rather than constructing its own `Worker` instance and lifecycle hooks by
hand. `RawBullMqProcessor` owns worker construction, trace/CLS wrapping, and
the `OnModuleInit`/`OnModuleDestroy` lifecycle so a subclass supplies only
its queue name, span name, job handler, and failure hook — a base-class fix
(such as an added `Worker` `"error"` listener) then reaches every worker
without a per-processor change.

#### Scenario: A new worker processor is added

- **WHEN** a new BullMQ worker processor is added to the codebase
- **THEN** it extends `RawBullMqProcessor<TData>` and supplies `queueName`,
  `spanName`, `processJob`, and `onJobFailed`
- **AND** it does not call `new Worker(...)` directly

#### Scenario: TelegramProcessor extends the base class

- **GIVEN** `TelegramProcessor` in `apps/api/src/modules/telegram/telegram.queue.ts`
- **WHEN** the worker starts
- **THEN** its lifecycle (construction, trace wrapping, shutdown) is provided
  by `RawBullMqProcessor`, identical to `EmailReminderProcessor` and
  `PdfExportProcessor`
- **AND** no `new Worker(...)` call exists outside `RawBullMqProcessor` itself

### Requirement: A queue's default job options have exactly one production source

A queue's producers MUST import and use its named default job-options
constant rather than repeating an equivalent literal inline, so the constant
is the queue's single source of truth for its retry policy.

#### Scenario: The admin Telegram smoke-test enqueue reuses the shared constant

- **GIVEN** `TELEGRAM_OUTBOUND_JOB_OPTS` is exported from `telegram.queue.ts`
- **WHEN** `admin.testTelegramSend` enqueues a job on the `telegram-outbound`
  queue
- **THEN** it spreads `TELEGRAM_OUTBOUND_JOB_OPTS` into the job options
  instead of declaring its own `attempts`/`backoff`/`removeOnComplete`/
  `removeOnFail` literal

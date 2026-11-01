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

### Requirement: Worker shutdown waits for in-flight failed-event hooks

The shared BullMQ worker base MUST NOT let `onModuleDestroy` resolve while a failed-event hook it started is still running. After the worker has closed it MUST wait for every pending hook, bounded by a fixed drain deadline that, added to the worker close deadlines, stays below the API `app.close` step deadline. A hook still pending at the deadline MUST be reported once as an error with the queue name and pending count, and shutdown MUST then continue. A rejecting hook MUST still reach Sentry and MUST NOT fail shutdown.

#### Scenario: Shutdown waits for a slow hook

- **WHEN** a `failed` event starts a hook that has not settled and the module is destroyed
- **THEN** `onModuleDestroy` stays pending until the hook settles

#### Scenario: A hook that never settles does not hold the process

- **WHEN** a hook is still pending at the drain deadline
- **THEN** one error log names the queue and the pending count and `onModuleDestroy` resolves

#### Scenario: A rejecting hook is captured and shutdown completes

- **WHEN** a hook rejects before or during shutdown
- **THEN** the rejection is captured by Sentry and `onModuleDestroy` resolves

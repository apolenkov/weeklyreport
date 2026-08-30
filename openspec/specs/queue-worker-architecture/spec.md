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

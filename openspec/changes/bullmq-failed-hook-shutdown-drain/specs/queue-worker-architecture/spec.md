## ADDED Requirements

### Requirement: Worker shutdown waits for in-flight failed-event hooks

The shared BullMQ worker base MUST NOT let `onModuleDestroy` resolve while a failed-event hook it started is still running. After the worker has closed it MUST wait for every pending hook, bounded by a fixed drain deadline shorter than the container stop grace period. A hook still pending at the deadline MUST be reported once as an error with the queue name and pending count, and shutdown MUST then continue. A rejecting hook MUST still reach Sentry and MUST NOT fail shutdown.

#### Scenario: Shutdown waits for a slow hook

- **WHEN** a `failed` event starts a hook that has not settled and the module is destroyed
- **THEN** `onModuleDestroy` stays pending until the hook settles

#### Scenario: A hook that never settles does not hold the process

- **WHEN** a hook is still pending at the drain deadline
- **THEN** one error log names the queue and the pending count and `onModuleDestroy` resolves

#### Scenario: A rejecting hook is captured and shutdown completes

- **WHEN** a hook rejects before or during shutdown
- **THEN** the rejection is captured by Sentry and `onModuleDestroy` resolves

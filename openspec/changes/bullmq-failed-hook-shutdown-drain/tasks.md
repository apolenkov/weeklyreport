# Tasks

## 1. Contract

- [x] 1.1 Shutdown waits for in-flight failed-event hooks, bounded (TASK-503.24).

## 2. Implementation

- [x] 2.1 RED: slow hook holds `onModuleDestroy`; never-settling hook is bounded and logged; rejecting hook control.
- [ ] 2.2 Track failed-hook continuations in `RawBullMqProcessor` and drain them after worker close.
- [ ] 2.3 GREEN, gates, independent review; synthetic-lane worker.close/restart proof (F489-3 acceptance) stays separate.

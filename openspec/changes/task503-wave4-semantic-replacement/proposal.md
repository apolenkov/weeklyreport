# Proposal

## Why

Concurrent requests for the same semantic indexing work can fail while a worker
already processes the replacement job. TASK-503 C1996 reproduced this with real
Queue and Worker clients on the assigned Redis4 lane; the retained work finishes.

## What Changes

- Reuse an active same-identity replacement after terminal-job removal fails.
- Preserve errors when the replacement is absent or not active.
- Cover enqueue outcomes and the real Queue/Worker interleaving.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-report-assistant`: semantic work already being processed remains pending
  instead of turning replacement contention into a technical failure.

## Impact

`SemanticIndexBullmqEnqueuer` and its existing test owner; no wire, schema,
dependency, role, lifecycle, or database changes. Evidence and tracking:
`/Users/wrk/work/handoffs/task-503/wave4/c1996-native.log`, TASK-503.07.

## Non-goals

- Changing compiled history, retry policy, trace identity, or terminal retention.
- Suppressing genuine queue failures or replacing active work.

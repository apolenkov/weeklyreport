# Proposal

## Why

C0854: prompt activation reads the feature pointer without a lock, then locks
the candidate and the previously active revision. A review counterexample
claims that an activation holding a stale pointer, a winning activation of the
same candidate and a restore of the previous revision form a lock cycle, so
PostgreSQL aborts one of them and the administrator sees an unexplained
`INTERNAL_SERVER_ERROR` instead of the controlled conflict. A free-running
probe did not reproduce it, and PostgreSQL may skip the stale supersede
without waiting, because the previous revision's committed version is already
superseded. Only the controlled schedule on PostgreSQL can settle the claim.

Backlog: TASK-503.49.

## What Changes

- A regression drives the real three-transaction schedule on PostgreSQL and
  asserts every side settles as success or a boolean conflict, with one active
  revision that the pointer names. The contract holds whichever transaction
  PostgreSQL picks as a victim.
- Only if that regression fails on the unchanged source, and the failure is
  reviewed, activation locks the feature control row before it reads the
  pointer, so all activations and restores of a feature share one lock order.
- Unrelated database failures (connection loss, timeouts, other errors) keep
  propagating; no blanket error mapping is added.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-prompt-management`: concurrent activation and restore of one feature
  settle as success or a controlled conflict.

## Impact

A PostgreSQL integration test beside
`apps/api/src/modules/ai-prompts/infrastructure/ai-prompt.repository.lifecycle.ts`,
and that file only if the regression fails. No schema, migration or client
change.

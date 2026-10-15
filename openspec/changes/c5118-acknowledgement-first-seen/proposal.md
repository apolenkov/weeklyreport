# Proposal

## Why

C5118: the acknowledge control is enabled with the label `Acknowledge` and
`aria-pressed=false` while the roster query is still loading, so an
already-acknowledged reviewer can acknowledge again. The repository upsert then
moves `seenAt` to now, which reorders the Head's "Seen by" roster (sorted by
`seenAt` descending) and shows a second success toast. Coordinator policy
(VERDICTS-008, BATCH-03) fixes the data contract: `seenAt` is the first view.

Backlog: TASK-503 (implementation queue 008, C5118). Source report:
`task-503/wave3/claude-D-C5118/REPORT.md` (external evidence archive).

## What Changes

- A repeated acknowledgement keeps the existing receipt unchanged; `seenAt`
  records the first acknowledgement.
- The control is inert until the roster has loaded: disabled, `aria-busy`, and
  no pressed state is claimed while the reviewer's own status is unknown.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-acknowledge-placement`: acknowledgement receipts record the first
  view, and the control waits for the roster.

## Impact

`apps/api/src/modules/review/infrastructure/review-actions.prisma-repository.ts`,
`apps/web/src/features/review/ui/review-acknowledge-bar.tsx` and their colocated
unit and integration tests.

## Non-goals

- Roster sort order (`seenAt` descending), access rules, lifecycle locking and
  the acknowledge procedure's input/output stay unchanged.
- No data migration: existing receipts keep their stored `seenAt`.

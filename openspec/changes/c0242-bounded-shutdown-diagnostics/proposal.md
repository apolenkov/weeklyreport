# Proposal

## Why

The shutdown coordinator writes its terminal timeout or drain-failure line with
`process.stderr.write` and requests exit in the same tick. On a pipe, Node
queues that write asynchronously, so `process.exit` can discard it. OCR finding
C0242 reproduces this natively: with 8 MiB queued on stderr and the parent
reading only after exit, the child exited 1 and the marker line was lost
(D37-V06 REPORT.md, line 40). Waiting for a write callback is not an option:
the drain-failure path has no deadline, and the fatal path has already spent
its five seconds when the line is written.

## What Changes

- The coordinator writes the terminal line with one synchronous, best-effort
  write to the descriptor owned by the runtime's standard-error stream,
  immediately before requesting exit. It never waits for a flush or callback.
- A failed write does not throw, change the exit code or delay the single exit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-shutdown-coordination`: add the requirement that terminal diagnostics
  never delay exit.

## Impact

`apps/api/src/bootstrap/shutdown-coordinator.ts` and the two colocated test
files. The change `partial-bootstrap-drain` also adds requirements to the same
capability under different names; archive order is coordinated by the owner.

## Non-goals

- No delivery guarantee when the pipe is already full or the reader is stalled.
- The `AppLogger`/Sentry exit race is out of scope.
- No change to the five-second deadline or the drain order.

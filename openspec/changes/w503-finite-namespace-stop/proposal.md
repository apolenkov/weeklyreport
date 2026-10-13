# Proposal

## Why

Stopping the tester stand can wait indefinitely for namespace finalizers, preventing port-forward cleanup. TASK-503 C0095 / TASK-503.11 identifies this remaining defect in the C0092 owner, `deploy/tester-kit/stop.sh`; `wave-01/HANDOFF-F.md` transfers that repair to F.

## What Changes

- Bound namespace deletion using kubectl's native timeout.
- Preserve the existing guarded context and namespace, cancellation behavior, and cleanup after deletion errors.
- Extend the executable stop regression owner to cover a forwarded finite timeout and error cleanup.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tester-kit-coverage`: finite tester stop completion and preserved failure/cleanup outcomes.

## Impact

Only tester-kit stop.sh, its existing focused tests, and this change. No new dependency, configuration knob, or shared resources.

## Non-goals

- Removing namespace finalizers or guaranteeing namespace disappearance after a timeout.
- Changing guards, other tester commands, process identity rules, or database operations.

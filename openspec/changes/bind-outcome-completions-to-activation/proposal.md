## Why

The outcome coordinator can adopt a delayed resolve or restore response after
the form leaves section A and returns to A, or after the owner unmounts. Its
section key matches again even though the command owner is obsolete.

## What Changes

- Bind server-result adoption to the active command token as well as the section.
- Invalidate ownership on unmount and retain valid same-activation completions.
- Specify and test resolve and restore across section changes and unmounts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-form-draft-orchestration`: outcome responses belong to their issuing activation.

## Impact

The web outcome coordinator and its tests change. Server transactions, command
IDs, idempotent retry payloads, and visible UI remain unchanged.

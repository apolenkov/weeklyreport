# Proposal

## Why

The session recovery screen compresses “Try again” to a 34 px button while its text is 59.7 px wide, leaving the text outside both borders. TASK-503/C5368 reproduces this on the public Head route at 1280 and 375 px widths; the other recovery boundaries use the same composition.

## What Changes

- Place existing recovery actions inside the existing AlertDescription layout in SessionProvider, ErrorRecoveryContent, and QueryErrorBoundary.
- Preserve each action's callback, accessible name, pending state, copy, and margin.
- Specify readable recovery actions without changing the shared Alert API.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `route-error-recovery`: recovery actions remain readable and keyboard reachable inside their visible button bounds.

## Impact

Three web recovery callers; no API, persistence, authentication, dependency, or shared Alert changes. Evidence: `~/work/handoffs/task-503/wave12/C5368-NATIVE-RED.json`; owning sources are `session-provider.tsx`, `error-recovery-content.tsx`, and `auth-runtime/error-boundary.tsx`.

## Non-goals

- Redesign error screens or change their error/copy policy.
- Change retry, pending, session transitions, or development last-role storage.
- Add a new Alert action slot or alter SVG layout for other callers.

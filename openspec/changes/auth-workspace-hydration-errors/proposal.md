# Proposal

## Why

When session hydration fails before a tRPC procedure starts, the request fails
closed but its procedure logger never runs. Support cannot correlate that
failure with the HTTP request. TASK-503.30 / C0527 identifies this gap in
`apps/api/src/bootstrap/api-ingress.ts`; the source-only analysis is retained in
`/Users/wrk/work/handoffs/task-503/wave3/010-C0527/REPORT.md`.

## What Changes

- Specify a safe correlated error event for context-construction failures at
  the mounted tRPC ingress, preserving existing error shaping and fail-closed
  session resolution.
- Exercise the real context factory and Express adapter through HTTP, with a
  controlled failure of an existing hydration dependency and success/null
  controls. Do not substitute a mocked context factory for this boundary.
- Add only the absent-context ingress diagnostic after intended RED and Root's
  scoped decision, without changing response formatting or authentication.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-hydration-error-scoping`: require request-correlated diagnostics for
  context failures without converting those failures into anonymous/dev sessions.

## Impact

The owning boundary is `mountApiIngress`, its context factory and existing
`AppLogger`. Production changes remain in `api-ingress.ts`; tests and this
OpenSpec change describe the boundary. No dependencies change.

## Non-goals

- Reopen accepted C0480, C0530 or C0534 decisions.
- Broaden period retries, parallelize hydration, add cache copies or singleflight.
- Claim a native PostgreSQL/Redis outage from a controlled dependency failure.
- Change the response `requestId` fallback or the client error contract before
  a separate Root decision.

# Proposal

## Why

TASK-503 C0877/C0885 and C0934 have real PostgreSQL assertion RED evidence in
`~/work/handoffs/task-503/wave-01/native-ai-baseline.log`: a delayed duplicate
activation resets an active winner's readiness, and a late capability retest
resurrects superseded A after B has activated.

## What Changes

- Atomically claim preparation against the revision snapshot and guard subsequent
  callbacks by their existing preparation start timestamp.
- Serialize capability-result persistence with activation and preserve the current
  active, superseded or preparing lifecycle rather than a provider-call snapshot.
- Preserve exact durable execution id/attempt/running CAS and all readiness gates.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-provider-configuration`: stale preparation and capability callbacks preserve
  the winning activation's lifecycle and readiness.

## Impact

AI provider preparation/activation services, repository commands and their current
tests. TASK-503 wave 01. Coordinator owns native GREEN, full gates and independent
review. No migration, credentials, HTTP, URL policy, authentication, dependencies
or runtime configuration changes. Other C0934 timestamp/suffix clauses stay OPEN.

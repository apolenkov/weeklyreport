# The MVP shares one disposable local database

**Status:** accepted
**Date:** 2026-09-18
**Superseded-by:** None

## Context

Provisioning one database per task lane multiplied reset and seed cost and left
stale lane databases behind, while no production data exists yet.

## Decision

Local development, tests, and E2E runs share the loopback `customreport_e2e`
database. `customreport_e2e_lane_a_test` and `customreport_e2e_lane_b_test` are
the only authorized isolated lanes. Every destructive operation passes
`prisma/guards/_destructive-guard.ts` and carries the per-command consent token.

## Alternatives

- A database per task: rejected, provisioning cost and orphaned databases.
- A shared database without a guard: rejected, one wrong URL would wipe real data.

## Consequences

No long-lived data may live in these targets; each phase begins with a guarded
reset and an explicit seed. Concurrent sessions must coordinate. See
`AGENTS.md#database-safety`.

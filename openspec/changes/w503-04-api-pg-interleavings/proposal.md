# Proposal

## Why

TASK-503.04 groups API findings whose open clauses are real PostgreSQL
interleavings, plus a Redis isolation gap in the unit contour (C2139). The
unit setup fills `REDIS_HOST`/`REDIS_PORT`/`REDIS_DB` with `??=`, so a unit test
that builds a real client instead of a mock inherits a developer's Redis or
reaches `localhost:6379` DB 15, the logical database the integration lane
uses.

## What Changes

- The API unit contour sets `REDIS_HOST` to an unresolvable `.invalid` name, so
  a real client built from the unit defaults fails on DNS before any command
  reaches a server. The coverage contour, which runs the integration suites
  against the guarded Redis target from `.env.test`, is unchanged.
- Further deltas for the PostgreSQL interleavings (C0707/C0724, C1665, C0976)
  are added here only after their real REDs, per the 008 policy of
  2026-10-15.

## Capabilities

### Modified Capabilities

- `test-evidence-integrity`: the unit contour cannot reach a real Redis.

## Impact

`apps/api/vitest.config.ts`, a new unit test next to the setup file, and its
exclusion from the coverage contour, which runs against the guarded Redis. The
earlier C2139 cap repair (8b6ac978) and its bounded connection observation stay
as recorded.

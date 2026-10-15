# Proposal

## Why

C1273: `GET /sessions/:id` lists a session's annotations ordered by the
client-supplied capture `timestamp` only. Ingress accepts equal timestamps, so
annotations with the same value come back in whatever order PostgreSQL returns
them, which can differ between reads of the same snapshot. Thread messages and
the pending list already break ties by server ID.

## What Changes

- The session snapshot orders annotations by capture timestamp, then by server
  ID, matching thread messages and the pending list.
- The wire shape and the numeric `data.sequence` field (C1287) are unchanged.
  The snapshot still returns every authorized annotation; this change does not
  make that a requirement, so the size decision for C1268 stays open.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authenticated-product-feedback`: add the stable snapshot order.

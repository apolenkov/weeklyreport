## Why

Agentation 3.0.2 uploads annotations that remain in browser Local Storage but
are absent from the server. An admin hard delete therefore succeeds, yet a
lead's stale browser can recreate the same item on its next synchronization.

## What Changes

- Retain a minimal terminal deletion tombstone after removing an Agentation
  annotation, its thread, captures, and prior evidence events.
- Publish that terminal state to connected clients so they remove the deleted
  annotation from local state.
- Treat a later create request with the deleted client identifier as a
  dismissed terminal response instead of recreating the annotation.

### Non-goals

- No Agentation package patch or fork.
- No retention of deleted annotation content, thread, captures, or evidence.
- No change to admin-only confirmation, visibility scope, or legacy feedback
  deletion.

## Capabilities

### Modified Capabilities

- `authenticated-product-feedback`: make confirmed Agentation deletion durable
  across active and stale browser clients.

## Impact

The change affects the Agentation repository, admin deletion transaction, and
focused API tests. It adds no schema migration: the existing event store holds
the minimal terminal marker.

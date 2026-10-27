# Proposal

## Why

`agentation.repository.helpers.ts` declares one ordering contract for every
persisted annotation thread: timestamp, then server ID
(`THREAD_MESSAGES_INCLUDE`). The session snapshot, the pending list and the
reply/action write paths use it. The feedback inbox does not: its list and its
edit, status and dismiss paths order thread messages by `timestamp` alone.

Replies are stamped with the server clock in milliseconds, so two replies in
the same millisecond tie. The inbox then lists them in whatever order
PostgreSQL returns, which can differ from the snapshot the Agentation client
syncs.

## What Changes

- Inbox reads and write responses use the shared thread ordering contract.
- No wire, schema or payload-type change. Whether the server-ID tie-break
  should instead reflect creation order is out of scope and recorded as an open
  question.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authenticated-product-feedback`: the inbox thread order matches the session
  snapshot.

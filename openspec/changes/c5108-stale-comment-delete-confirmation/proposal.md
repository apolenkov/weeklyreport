# Proposal

## Why

A reviewer can open the "Delete review comment?" confirmation and keep it
open while the record refreshes. If the reviewer loses review rights or the
comment is removed elsewhere in the meantime, the confirmation stays open and
actionable; confirming only produces a server rejection, and after a failed
delete the stale confirmation stays open for retries (C5108). The server
already decides every delete; the client keeps a stale intent alive.

## What Changes

- An open delete confirmation closes as soon as its comment is no longer in
  the record's comment list or the current actor may no longer delete it.
- The server-side authorization is unchanged.

## Capabilities

### record-comment-save-coordination

ADDED: a delete confirmation follows the live comment list and permission.

## Impact

`apps/web/src/features/review/ui/comments/record-comments.tsx` and its test.

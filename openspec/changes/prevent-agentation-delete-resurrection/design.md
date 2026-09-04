## Context

Agentation keeps a client-generated annotation identifier in Local Storage.
When a stored session reconnects, the client uploads any local annotation that
is missing from the server. Removing every server row and event therefore
makes a valid admin deletion indistinguishable from incomplete synchronization.

## Decisions

### Keep a content-free terminal tombstone

The deletion transaction removes the annotation row, cascading its thread and
captures, and removes all prior events for that annotation. It then appends one
`annotation.updated` event containing only server/client identifiers, author ID, kind,
`status: dismissed`, and `deleted: true`.

Connected clients already consume terminal `annotation.updated` states and
remove them from local annotations. The marker contains no deleted comment,
selector, page evidence, thread, or capture.

### Recognize both identifiers within the author's scope

Before creating an annotation, the repository looks for a deletion tombstone
in the authorized session and author scope with the same original client ID
or server ID. Agentation replaces the local ID with the server ID after sync.
If found, it
returns a dismissed terminal response without inserting a row or emitting a
new creation event. Agentation then removes the stale local item.

The lookup requires the explicit `deleted: true` discriminator so ordinary
annotation updates never suppress a live annotation.

Before creating a row, the repository also recognizes existing annotations by
either ID within the same session and author scope. A replay arriving before
deletion therefore returns the original row rather than creating a duplicate.

## Safety

The existing server-derived session scope applies to both tombstone lookup and
deletion. The tombstone is written in the same transaction as the hard delete,
so clients cannot observe deletion without its terminal marker. Creation,
deletion, and thread writers acquire a session FOR NO KEY UPDATE lock before
an annotation row lock. It remains compatible with FK KEY SHARE checks from
concurrent status/edit writers, avoiding inverted lock-order deadlocks. Creation
holds that same session lock across tombstone lookup and insert. This serializes
both possible POST/DELETE orders, including a replay of a now-missing row.

## Event delivery

SSE responses use `Cache-Control: no-cache, no-transform` so the same-origin
proxy does not gzip-buffer terminal events. An initial SSE comment starts the
response body immediately.

A fresh human session stream captures its current event sequence, then replays
only deletion tombstones through that sequence in bounded pages. Live polling
starts after the captured sequence. This closes the page-snapshot-to-stream
gap without replaying old resolved or reopened states. Connections carrying
`Last-Event-ID` retain their normal incremental replay.

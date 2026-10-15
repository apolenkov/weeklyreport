# Proposal

## Why

`POST /sessions/:id/action` answers with `delivered.sseListeners`, and the code
fills it from the process-wide count of connected agent SSE listeners. A
review (C1260) read the field as per-session delivery and called the count
misleading. The spec never said what the field means. The installed
`agentation-mcp@1.3.2` reference server returns the same value
(`agentConnections.size`, a set holding both global and session-scoped agent
connections), and no client in this repository reads the field.

## What Changes

- The spec states the existing semantics: an advisory snapshot of connected
  agent listeners in this API process when the action is accepted, matching
  the upstream server; not an acknowledgement that any listener received the
  event, and not a per-session count.
- No code change. Session filtering of the count is rejected: it would change
  the upstream wire meaning and still could not acknowledge delivery.

## Capabilities

### authenticated-product-feedback

ADDED: the action response delivery count is an advisory, upstream-compatible
process snapshot.

## Impact

Documentation of current behaviour only. Event authorization, session scoping
of streams, and `action.requested` emission are unchanged.

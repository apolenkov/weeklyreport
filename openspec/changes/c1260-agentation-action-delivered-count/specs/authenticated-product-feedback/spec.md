# Spec Delta

## ADDED Requirements

### Requirement: The action response reports an advisory listener count

`POST /sessions/:id/action` MUST answer with
`delivered: { sseListeners, webhooks, total }`, as the installed
`agentation-mcp` reference server does. `sseListeners` MUST be the number of
agent SSE listeners (`?agent=true`) connected to this API process when the
response is built, counting global and session-scoped listeners alike;
`webhooks` is `0` and `total` equals `sseListeners`. The count is advisory: it
MUST NOT be presented as an acknowledgement that any listener received the
`action.requested` event, nor as a count of listeners for that session.
Each listener reads stored events through its own authorized, scope-filtered
polling, which runs independently of the action request; there is no ordering
between the response and any delivery, and a listener counted in the response
may never receive the event on that connection. Other API processes' listeners
are not counted.

#### Scenario: Listeners of another session are counted but not served

- **GIVEN** one agent listener is connected to the stream of session B
- **WHEN** an action is requested for session A
- **THEN** the response reports `sseListeners` of at least `1`
- **AND** the listener for session B does not receive session A's event

#### Scenario: A global agent listener receives the action

- **GIVEN** an authorized agent listener is connected to the global stream
- **WHEN** an action is requested for a session it may read
- **THEN** while that connection stays open and its polls succeed, the
  listener receives `action.requested`
- **AND** the response does not depend on that delivery

#### Scenario: The count does not confirm delivery

- **WHEN** a counted listener disconnects before its poll reads the event
- **THEN** that connection does not deliver it, and the response already sent
  is unchanged

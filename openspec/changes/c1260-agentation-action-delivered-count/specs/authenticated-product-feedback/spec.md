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
Listeners receive the event through their own authorized, session-scoped
polling, which runs asynchronously after the response and stops when a
listener disconnects; a listener counted in the response may therefore never
receive it. Other API processes' listeners are not counted.

#### Scenario: Listeners of another session are counted but not served

- **GIVEN** one agent listener is connected to the stream of session B
- **WHEN** an action is requested for session A
- **THEN** the response reports `sseListeners` of at least `1`
- **AND** the listener for session B does not receive session A's event

#### Scenario: A global agent listener receives the action

- **GIVEN** an authorized agent listener is connected to the global stream
- **WHEN** an action is requested for a session it may read
- **THEN** that listener receives `action.requested` on a later poll
- **AND** the response count was computed before that delivery

#### Scenario: The count does not confirm delivery

- **WHEN** a counted listener disconnects before its next poll
- **THEN** it never receives the event, and the response is unchanged

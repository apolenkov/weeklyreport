## ADDED Requirements

### Requirement: An action event MUST NOT exceed 1 MiB

The server MUST measure the serialized `action.requested` payload (UTF-8 JSON
bytes) before persisting it. When it exceeds 1 MiB, the action MUST be refused
with the feedback limit error (HTTP 409) and no event MUST be persisted or
streamed. Below the limit the event MUST carry every annotation of the session.

#### Scenario: the action payload exceeds the limit

- **WHEN** a session's annotations and threads serialize above 1 MiB
- **AND** an action is requested for that session
- **THEN** the request is refused with the feedback limit error
- **AND** no `action.requested` event is persisted or streamed

#### Scenario: the action payload is within the limit

- **WHEN** a session's annotations and threads serialize below 1 MiB
- **THEN** exactly one `action.requested` event carrying every annotation is
  persisted

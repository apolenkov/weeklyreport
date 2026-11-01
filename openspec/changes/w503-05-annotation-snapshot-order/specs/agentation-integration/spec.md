## ADDED Requirements

### Requirement: A session snapshot MUST list annotations in a stable order

The session snapshot (`GET /sessions/:id`) MUST order a session's annotations
by capture timestamp and then by server ID, so annotations that share a capture
timestamp appear in the same order on every read.

#### Scenario: annotations share a capture timestamp

- **WHEN** several annotations in one session carry the same capture timestamp
- **THEN** the snapshot lists them in ascending server-ID order
- **AND** repeated reads return the same order

#### Scenario: annotations have distinct capture timestamps

- **WHEN** annotations carry different capture timestamps
- **THEN** the snapshot lists them in ascending timestamp order

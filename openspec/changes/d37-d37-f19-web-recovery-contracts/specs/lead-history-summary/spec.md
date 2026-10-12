## ADDED Requirements

### Requirement: History role subtitle waits for session resolution

The History page MUST reserve its subtitle line while the session loads, without presenting a role-specific subtitle until the session resolves.

#### Scenario: History session is unresolved

- **WHEN** History mounts while the session is loading
- **THEN** no personal, compiled or published subtitle is displayed
- **AND** the resolved role displays its existing subtitle

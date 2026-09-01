## ADDED Requirements

### Requirement: Local error tracking uses the reviewed single-user contract

The repository-owned Bugsink overlay MUST enable its local-only single-user
mode through the reviewed image's `SINGLE_USER` setting and MUST NOT retain
unsupported compatibility aliases.

#### Scenario: The local Bugsink container starts

- **WHEN** Compose renders the current error-tracking overlay
- **THEN** `SINGLE_USER` is explicitly enabled
- **AND** no obsolete single-user environment alias is present

### Requirement: Local error-tracking state survives container replacement

The repository-owned Bugsink overlay MUST mount its named data volume at the
runtime image's canonical `/data` path so its SQLite database remains outside
the replaceable container filesystem.

#### Scenario: The Bugsink container is replaced

- **WHEN** the error-tracking container is recreated with its named volume
- **THEN** the SQLite database remains available at `/data/db.sqlite3`
- **AND** the mounted state remains readable after container replacement

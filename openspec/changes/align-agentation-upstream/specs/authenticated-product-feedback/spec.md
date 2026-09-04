## ADDED Requirements

### Requirement: Agentation integration MUST prefer supported upstream mechanisms

WeeklyReport MUST use the unmodified public Agentation widget and MCP client.
Custom protocol behavior MUST be limited to requirements not met by supported
upstream mechanisms and MUST have a documented reason and an executable check.
The integration MUST NOT import package internals, patch dependencies, or replace
PostgreSQL or server-authoritative identity merely to remove adapter code.

#### Scenario: A dependency upgrade changes its wire behavior

- **WHEN** the installed Agentation or MCP dependency is updated
- **THEN** public type and executable consumer contracts verify the adapter
- **AND** compatibility MUST NOT depend on formatting of a compiled bundle
- **AND** an incompatible result blocks acceptance rather than changing access or deletion semantics silently

#### Scenario: A supported upstream mechanism can replace custom code

- **WHEN** source-bound comparison proves that a public upstream mechanism satisfies the same requirement
- **THEN** the integration uses that mechanism without keeping a parallel implementation

#### Scenario: Upstream lacks a required extension point

- **WHEN** stock behavior cannot preserve required storage, attribution, access, or deletion semantics
- **THEN** the adapter retains that boundary with its requirement, source evidence, and test
- **AND** a change to those requirements requires explicit user approval

#### Scenario: A cached browser page returns after administrative deletion

- **WHEN** an administrator deletes an annotation while its author's page is away
- **AND** the browser restores the cached page through back or forward navigation
- **THEN** the public widget starts a fresh server synchronization
- **AND** a deleted annotation does not remain as a stale marker or recreate server content

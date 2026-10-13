## ADDED Requirements

### Requirement: An unpinned report entry resolves the current active identity

An initial unpinned weekly-report visit MUST resolve the current active report before pinning its report ID. A cached identity from a previous visit MUST NOT itself authorize that redirect. An explicitly selected report MUST retain its existing selection and background-refresh behavior.

#### Scenario: A different report becomes active between visits

- **GIVEN** a prior visit cached active report A and an administrator subsequently activates report B
- **WHEN** the user returns through the unpinned report entry while A is still cached
- **THEN** the entry waits for current active resolution and pins B
- **AND** it does not redirect to cached A before resolution

#### Scenario: Active resolution is paused offline

- **GIVEN** a former active report is cached and the current active request is paused offline
- **WHEN** the user opens the unpinned report entry
- **THEN** no cached report ID is pinned as current before a successful current resolution

## ADDED Requirements

### Requirement: Initial PDF dispatch failure remains the primary request error

The initial `pdfExport.request` dispatch failure MUST remain the primary error returned by its service boundary even when generation-bound failure persistence rejects. The API MUST retain diagnostics for the original failure and separately identify the compensation failure by job and generation. Internal error details MUST NOT be exposed in the transport response.

#### Scenario: Compensation fails after initial dispatch rejects

- **GIVEN** an authorized published-report request created a queued export at generation 1
- **WHEN** initial dispatch rejects and failure persistence also rejects
- **THEN** the request service rejects with the original dispatch error
- **AND** diagnostics distinguish the secondary persistence failure for the same job and generation
- **AND** the failed persistence is not reported as a successful durable state change

#### Scenario: Compensation succeeds after initial dispatch rejects

- **GIVEN** an authorized published-report request created a queued export at generation 1
- **WHEN** initial dispatch rejects and failure persistence succeeds
- **THEN** the request service rejects with the original dispatch error
- **AND** the generation-bound export is marked failed by the existing terminal-state fence

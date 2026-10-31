## MODIFIED Requirements

### Requirement: Required Lead reads expose recoverable terminal outcomes

The Lead form MUST distinguish pending reads from settled failures of the active
period, by-period section, personal history, view settings and cross-author
reads. The view-settings and cross-author reads MUST NOT start before the section
fetch is enabled. A required-read failure MUST show persistent recovery without
exposing stale editable controls. Retry MUST request the failed required reads
and MUST NOT refetch successful independent reads. Repeated Retry while its
request is pending MUST reuse that operation. A retry for an earlier report MUST
NOT change the recovery state of the current report.

#### Scenario: A supporting required read fails

- **GIVEN** the active-period or personal-history query fails
- **WHEN** the error settles
- **THEN** the Lead editor replaces its loading skeleton with persistent Retry
- **AND** the existing centralized error reporting records the failure

#### Scenario: A supporting read recovers after Retry

- **GIVEN** a required read is in error
- **WHEN** the lead retries
- **THEN** recovery remains visible and Retry is disabled while the request runs
- **AND** success reveals the current matching draft, or another failure leaves Retry available

#### Scenario: Navigation occurs during a retry

- **GIVEN** report A has a pending retry
- **WHEN** the lead navigates to report B and A's request later settles
- **THEN** B's read and recovery state is unaffected by A's completion

#### Scenario: A companion read fails

- **GIVEN** the view-settings or cross-author query fails after the section loaded
- **WHEN** the error settles
- **THEN** the Lead editor shows the shared load error with Retry instead of default view settings or an empty cross-author list

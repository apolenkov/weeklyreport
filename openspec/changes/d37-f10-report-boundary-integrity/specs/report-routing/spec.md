## ADDED Requirements

### Requirement: Pending weekly report reads do not imply no period

The weekly report page MUST show loading while its no-data query remains pending, including paused or idle fetch status. The no-active-period notice MUST require actual successful no-period data. Existing invalid-link/transient-error classification and usable same-key dataful background refresh MUST remain unchanged.

#### Scenario: An initial report query is offline

- **WHEN** the query has no data and is pending with fetching paused
- **THEN** the page shows loading and no no-active-period notice
- **AND** after reconnection an actual active response renders the report

#### Scenario: The completed request reports no period

- **WHEN** the request succeeds with explicit no-period data
- **THEN** the page shows the no-active-period notice

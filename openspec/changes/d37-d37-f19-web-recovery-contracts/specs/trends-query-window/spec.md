## ADDED Requirements

### Requirement: Comparison Retry refreshes every failed dependency

Period comparison Retry MUST refetch each dependency currently in error independently and MUST NOT refetch a successful dependency.

#### Scenario: Both comparison dependencies fail

- **GIVEN** cached history and comparison results have both failed to refresh
- **WHEN** the user retries Period comparison
- **THEN** both failed queries are refetched once

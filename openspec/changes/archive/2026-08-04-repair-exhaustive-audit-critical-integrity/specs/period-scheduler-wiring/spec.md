## ADDED Requirements

### Requirement: Current-period lookup selects only a coupled live tuple

The login-time and scheduler current-period factory MUST select an existing report only when legacy status is draft, archived is false, canonical state is scheduled or open, and all lifecycle fields form a valid tuple for the requested boundary.

#### Scenario: Archived draft occupies the requested boundary

- **WHEN** an archived row retains legacy draft status and its dates contain the requested instant
- **THEN** current-period lookup excludes that row and finds or creates the valid live row

#### Scenario: Contradictory row occupies the requested boundary

- **WHEN** a row matches the date boundary but its canonical and legacy lifecycle fields disagree
- **THEN** lookup fails with a typed integrity error and MUST NOT return or overwrite the row

#### Scenario: Valid scheduled or open row exists

- **WHEN** exactly one complete live tuple matches the requested boundary
- **THEN** the factory returns that row without creating a duplicate

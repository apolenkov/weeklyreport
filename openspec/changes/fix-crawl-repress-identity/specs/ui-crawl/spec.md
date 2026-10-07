## ADDED Requirements

### Requirement: Repeated presses verify live identity

The crawler MUST repeat an action only when its live control retains the complete normalized name, native tag, role and original probe anchor. Empty identity or unavailable controls MUST NOT authorize synthetic events. A mismatch MUST leave the observed state available to the existing bounded restoration path.

#### Scenario: A replacement shares the original label prefix

- **WHEN** the original control is replaced by a different action with a shared label prefix
- **THEN** no repeated event is sent to the replacement

#### Scenario: The same toggle remains available

- **WHEN** the original identified toggle remains available after its first press
- **THEN** repeating it can restore the original observed state

#### Scenario: Availability changed

- **WHEN** the identified control becomes disabled or covered
- **THEN** no repeated event is sent

## ADDED Requirements

### Requirement: Editable projections share their current lifecycle owner

The locked Report matcher, current editable selector and product-assignment editable scan MUST derive their existing draft/open and published/reopened lifecycle subset from one owner. Complete canonical lifecycle validation, row locks, outcomes and deterministic report-id order MUST remain unchanged.

#### Scenario: Date policies remain distinct

- **WHEN** the current editable selector is built for a clock instant
- **THEN** it retains periodStart at or before that instant
- **AND** direct locked eligibility and the all-editable product assignment scan retain their existing absence of a date bound

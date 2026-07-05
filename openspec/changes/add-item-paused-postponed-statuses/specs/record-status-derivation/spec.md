# record-status-derivation (delta)

## ADDED Requirements

### Requirement: Paused and postponed are first-class item workflow states

`ItemWorkflowStatus` (Prisma enum + shared Zod item schemas) MUST accept `paused` and `postponed` alongside `in_progress`, `done`, `blocked`. Both states MUST roll up as not-done and MUST NOT feed the blocked/at-risk escalation paths (dashboard escalations, `at_risk` roll-up, product health derivation stay untouched by them).

#### Scenario: Lead pauses an item

- **WHEN** the author sets an own current item's workflow status to `paused` and saves the section
- **THEN** the existing item mutation persists the state and the item counts as not-done everywhere done-ness is derived (completeness, readiness, velocity)

#### Scenario: Paused work does not escalate

- **WHEN** a section contains only `paused`/`postponed` items and no risks
- **THEN** the dashboard blocked/at-risk tables and the product health status show no escalation caused by those items

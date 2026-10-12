# enum-state-hygiene Specification

## Purpose

Require every persisted enum value to have a production writer or be removed
consistently from persistence, shared schemas, and domain mappings.

## Requirements

### Requirement: Every persisted enum value has a writer or is removed

Every persisted enum value MUST either be written by some production code path or
be removed. This applies to each Prisma enum and its Zod mirror in
`@weeklyreport/shared` plus the domain-to-db mapper. A value that is read, indexed,
or anticipated but never written MUST NOT linger as a dead state; it is either
implemented (writer + test) or deleted.

#### Scenario: A declared enum value has no production writer

- **WHEN** an enum value is declared but no production path ever persists it
- **THEN** it is either implemented — a writer added with a test asserting the
  value is persisted — or removed from the Prisma schema, the Zod enum, and the
  mapper
- **AND** the chosen disposition is recorded so intent is reviewable

#### Scenario: Persisted enum values have current dispositions

- **WHEN** a persisted enum value is audited
- **THEN** its current production writer, reader, schema mirror, and mapper are
  covered together; a value without that contract is removed consistently
- **WHEN** a reminder rule is read by the scheduler and represented in the
  admin reminder card's next-send projection
- **THEN** policy save writes `active ? "active" : "paused"` to its derived
  rules, so enabling or pausing a policy controls dispatch immediately

# enum-state-hygiene Specification (delta)

Adds a hygiene requirement for persisted enum values, prompted by three declared
states with no production writer (`CarryOverStatus.failed`,
`ReminderRuleStatus.paused`, `PdfExportStatus.processing`).

## ADDED Requirements

### Requirement: Every persisted enum value has a writer or is removed

Every persisted enum value MUST either be written by some production code path or
be removed. This applies to each Prisma enum and its Zod mirror in
`@customreport/shared` plus the domain-to-db mapper. A value that is read, indexed,
or anticipated but never written MUST NOT linger as a dead state; it is either
implemented (writer + test) or deleted.

#### Scenario: A declared enum value has no production writer

- **WHEN** an enum value is declared but no production path ever persists it
- **THEN** it is either implemented — a writer added with a test asserting the
  value is persisted — or removed from the Prisma schema, the Zod enum, and the
  mapper
- **AND** the chosen disposition is recorded so intent is reviewable

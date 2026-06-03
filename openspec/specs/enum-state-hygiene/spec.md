# enum-state-hygiene Specification

## Purpose

TBD - created by archiving change cleanup-dead-enum-states. Update Purpose after archive.

## Requirements

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

#### Scenario: The three audited values are dispositioned

- **WHEN** `CarryOverStatus.failed`/`pending` are audited — the service writes
  only `completed`, with no designed error or queued path
- **THEN** they are removed; the enum collapses to `completed` and the column
  default moves `pending`→`completed`
- **WHEN** `PdfExportStatus.processing` is audited — export goes
  `queued`→`completed`/`failed` with no in-flight write
- **THEN** it is removed from the db enum, the domain enum, and the mapper
- **WHEN** `ReminderRuleStatus.paused` is audited — found read by the scheduler,
  rendered by the derived-rules panel, and mapped on both web sides, with only
  the write trigger missing
- **THEN** it is implemented: pausing or archiving a `ReminderPolicy` cascades
  its `active` flag onto the policy's derived `ReminderRule` rows
  (`active ? "active" : "paused"`) at policy-save time, so the scheduler stops
  firing them immediately; the reader and anticipatory `@@index([status, fireAt])`
  are retained

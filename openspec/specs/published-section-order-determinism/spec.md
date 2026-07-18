# published-section-order-determinism Specification

## Purpose

Requires the frozen published snapshot to order sections deterministically, matching the head's live-preview ordering so every viewer and lead reads the same order.

## Requirements

### Requirement: The frozen published snapshot orders sections deterministically

The query that builds the durable published-report snapshot MUST apply an
explicit `orderBy` on the `sections` relation of
`reportFullIncludeForSnapshot`, so the frozen section order is deterministic
at freeze time and does not depend on Postgres heap order. This ordering
MUST match the author-name ordering `getAssembledReport`'s live preview
already applies (`compareSections`), so a viewer or lead reading the
published artifact sees the same section order the head saw in the preview
before publishing.

#### Scenario: Published section order matches the preview order

- **GIVEN** a report with sections authored by three or more different
  leads, created in a non-alphabetical order
- **WHEN** the report is published and its frozen snapshot is read
- **THEN** the sections appear in author-name order
- **AND** that order matches the order `getAssembledReport`'s live preview
  produced for the same sections before publishing

#### Scenario: Published section order is stable across reads

- **GIVEN** a published report's frozen snapshot
- **WHEN** it is read multiple times
- **THEN** the section order is identical on every read

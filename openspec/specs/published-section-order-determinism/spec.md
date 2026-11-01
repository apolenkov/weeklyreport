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

### Requirement: Canonical section relations use current keys followed by identity

Canonical live and frozen report-section projections MUST preserve the mapper's existing Russian activity-name comparison, with ascending activityId used only when that name comparison is equal. Each activity's linkedProducts MUST preserve the existing Russian product-name comparison, with ascending productId used only for equal-name ties. The shared sectionReviews query MUST request ascending createdAt, then ascending reviewerId for equal timestamps. The identity tie-break MUST NOT be interpreted as creation time, chronology or recency. These orders MUST NOT depend on physical relation retrieval order for equivalent unique-identity records.

#### Scenario: Activity and linked-product names collide

- **GIVEN** two unique activities with equal names and two unique linked products with equal names
- **WHEN** equivalent relation inputs arrive in opposite physical orders
- **THEN** the actual canonical live mapper and frozen projection produce the same activity and linked-product identity order
- **AND** distinct names retain their existing primary name priority even when their IDs sort in the opposite order

#### Scenario: Review timestamps collide

- **WHEN** the shared report-section read queries reviews with equal createdAt values
- **THEN** the query requests reviewerId as an ascending tie-break after createdAt
- **AND** differing timestamps retain chronological createdAt priority without treating reviewer IDs as timestamps

## Purpose

Guarantees that report record collections keep one identity-bound presentation
order across reads, saves, and equivalent canonical seed rebuilds.

## ADDED Requirements

### Requirement: Report record reads expose a deterministic identity order

The report-section repository methods and their tRPC consumers MUST return each
section's `items`, `risks`, and `decisions` in ascending durable `stableId`
order. The result MUST NOT depend on database insertion, heap, or relation
retrieval order.

#### Scenario: Physical row order differs

- **WHEN** equivalent report records exist in different physical database orders
- **THEN** every report-section read returns the same ordered `items`, `risks`, and `decisions` arrays

#### Scenario: Records have identical user-facing content

- **WHEN** two records in one collection have equal mutable user-facing fields
- **THEN** their unique durable identities still define one total and repeatable order

### Requirement: Durable identity survives record writes

The report-section save and carry-over write paths MUST preserve the existing
durable `stableId` of every continuing item, risk, and decision. A volatile
primary key recreated during a save MUST NOT become the presentation-order
identity.

#### Scenario: Section records are saved and recreated

- **WHEN** a lead saves an existing report section and child rows receive new primary keys
- **THEN** the same logical records retain their `stableId` values and relative read order

#### Scenario: A new record is created

- **WHEN** a lead adds a genuinely new item, risk, or decision
- **THEN** the record receives a unique durable identity that participates in the same total order

### Requirement: Canonical seed rebuilds reproduce record identity

The canonical seed profiles consumed by local development, integration tests,
and bounded product acceptance MUST assign deterministic primary and durable
identities to their item, risk, and decision records. Equivalent guarded
reset/reseed operations MUST produce the same identities and ordered read
models.

#### Scenario: Full seed profile is rebuilt

- **WHEN** the authorized disposable database is independently reset and seeded twice with the same full profile
- **THEN** corresponding seeded items, risks, and decisions have identical `id` and `stableId` values and appear in identical read order

#### Scenario: Seed overlay adds a record

- **WHEN** a deterministic overlay adds an item, risk, or decision to an existing seeded section
- **THEN** the overlay record has a deterministic durable identity and its position is derived by the same identity order

# Report Record Ordering Specification

## Purpose

Guarantees that report record collections keep one identity-bound presentation
order across reads, saves, and equivalent canonical seed rebuilds.

## Requirements

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

### Requirement: Section writes recheck published identity under the Report lock

After locking and validating the parent Report, save and submit MUST resolve the section's current item and decision stable IDs against published lineage inside the same transaction. They MUST compare that authoritative lineage with the final merged section before the section version compare-and-set or any child-row deletion. Omitting a published identity MUST raise the existing typed `PUBLISHED_RECORD_LOCKED` denial and MUST write nothing. Omitting a never-published draft identity MUST remain allowed.

#### Scenario: Publish and reopen finish after the save precheck

- **GIVEN** a save or submit precheck found no published lineage for the current section
- **AND** publish and reopen commit before the write transaction locks the Report without changing the section version
- **WHEN** the transaction rechecks lineage and the final section omits the newly published identity
- **THEN** it raises `PUBLISHED_RECORD_LOCKED`
- **AND** it does not increment the section version or delete child rows

#### Scenario: Final section preserves the newly published identity

- **GIVEN** the locked recheck resolves an item or decision as published
- **WHEN** the final merged section retains that stable ID
- **THEN** the lineage check passes
- **AND** the existing version compare-and-set and save flow continue

#### Scenario: Post-publication draft addition is removed

- **GIVEN** a reopened section contains an item or decision added after its latest publication
- **AND** no publication source contains that stable ID
- **WHEN** the final merged section omits the draft-only identity
- **THEN** the locked lineage check passes
- **AND** the draft-only row remains deletable

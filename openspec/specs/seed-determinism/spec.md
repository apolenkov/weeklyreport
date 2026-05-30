# seed-determinism Specification

## Purpose

TBD - created by archiving change fix-seed-stagestatus-id-collision. Update Purpose after archive.

## Requirements

### Requirement: Seed Entity IDs MUST Be Collision-Free Across Index Ranges

Seed-generated entity primary keys MUST map each distinct index tuple to a distinct id across the full range of seed data, including leads owning ten or more products. Index components composed into an id MUST be fixed-width (zero-padded) so concatenation stays injective, and the result MUST remain a valid UUID.

#### Scenario: Advanced seed runs to completion

- **WHEN** `pnpm db:fresh:advanced` runs against a clean database
- **THEN** every `StageStatus` row is created without a `P2002` unique-constraint violation
- **AND** the seed prints its final summary

#### Scenario: A lead owns ten or more products

- **WHEN** the seed generates StageStatus ids for a lead whose product count reaches double digits
- **THEN** each `(leadIndex, prodSeq, stageSeq)` tuple yields a unique id
- **AND** no two distinct tuples produce the same primary key

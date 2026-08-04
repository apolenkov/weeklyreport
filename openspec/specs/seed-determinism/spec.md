# seed-determinism Specification

## Purpose

Make seed-generated identities collision-free across index ranges and require the canonical seed to cover the full item-status vocabulary.

## Requirements

### Requirement: Seed Entity IDs MUST Be Collision-Free Across Index Ranges

Seed-generated entity primary keys MUST map each distinct index tuple to a distinct id across the full range of seed data, including leads owning ten or more products. Index components composed into an id MUST be fixed-width (zero-padded) so concatenation stays injective, and the result MUST remain a valid UUID.

#### Scenario: Advanced seed runs to completion

- **WHEN** `pnpm db:reset:hard full` runs against a disposable clean database
- **THEN** every `StageStatus` row is created without a `P2002` unique-constraint violation
- **AND** the seed prints its final summary

#### Scenario: A lead owns ten or more products

- **WHEN** the seed generates StageStatus ids for a lead whose product count reaches double digits
- **THEN** each `(leadIndex, prodSeq, stageSeq)` tuple yields a unique id
- **AND** no two distinct tuples produce the same primary key

### Requirement: The Canonical Seed Covers The Full Item-Status Vocabulary

The canonical seed script (`prisma/seed.ts`) MUST populate at least one
`paused` item and one `postponed` item in its active-period data, and MUST
call `assertSeedCoverage` at the end of its `main()` so a missing status is
caught at seed time rather than silently shipped to every default dev/test
database. `prisma.config.ts` delegates Prisma seeding to `seed-profile.ts full`,
whose full profile invokes this canonical script.

#### Scenario: A fresh reseed carries every Progress state

- **WHEN** `pnpm db:seed:profile full` runs the full profile against a clean
  database
- **THEN** the resulting `Item` rows include at least one `paused` status and
  at least one `postponed` status
- **AND** `main()` completes without the coverage guard throwing

#### Scenario: A dropped status fails the seed run loudly

- **WHEN** the canonical seed is modified so that no item carries a required
  status (for example `paused` is removed)
- **THEN** `assertSeedCoverage` throws and `main()` exits with a non-zero code
  instead of completing silently

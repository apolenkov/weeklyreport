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

### Requirement: Seed completion verifies Lead assistant retrieval readiness

The canonical and demo seed workflows MUST run a database-backed readiness assertion before reporting success. For their advertised assistant fixtures, the assertion MUST verify canonical current source selection, caller section ownership, non-empty authorized candidate projection, schema-valid populated published snapshots, and unique deterministic occurrence identities. It MUST use the real `ReportSearchPrismaRepository` boundary or an integration harness over the same production mapper and authorization functions.

#### Scenario: Empty current source fails loudly

- **WHEN** a newer eligible seeded live report has no canonical primary-Lead section or projects no candidate
- **THEN** the readiness assertion fails the seed command with a non-zero exit
- **AND** it reports the report identifier and failed readiness stage without printing report text

#### Scenario: Empty or absent published snapshot fails loudly

- **WHEN** a published report advertised for assistant history has a null snapshot, an empty `sections` array, or content that fails canonical snapshot parsing
- **THEN** the readiness assertion fails the seed command with a non-zero exit
- **AND** it does not accept mutable published live rows as a fallback

#### Scenario: Reseeding remains stable

- **WHEN** the same supported seed tier runs twice for the same run week
- **THEN** report, section, record, and occurrence identities remain identical
- **AND** the same current and published candidate kinds pass readiness on both runs

#### Scenario: Automated readiness avoids external AI

- **WHEN** seed readiness or its PostgreSQL integration coverage runs
- **THEN** it performs exact retrieval with deterministic planner/answer fakes or invokes the retrieval boundary below provider orchestration
- **AND** it makes no Mistral request and does not require a populated embedding cache

#### Scenario: A dropped status fails the seed run loudly

- **WHEN** the canonical seed is modified so that no item carries a required
  status (for example `paused` is removed)
- **THEN** `assertSeedCoverage` throws and `main()` exits with a non-zero code
  instead of completing silently

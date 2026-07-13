## ADDED Requirements

### Requirement: The Canonical Seed Covers The Full Item-Status Vocabulary

The canonical seed script (`prisma/seed.ts`) MUST populate at least one
`paused` item and one `postponed` item in its active-period data, and MUST
call `assertSeedCoverage` at the end of its `main()` so a missing status is
caught at seed time rather than silently shipped to every default dev/test
database. `prisma.config.ts` targets this script for `migrate reset` and
`db:seed`.

#### Scenario: A fresh reseed carries every Progress state

- **WHEN** `pnpm db:seed` runs the canonical seed against a clean database
- **THEN** the resulting `Item` rows include at least one `paused` status and
  at least one `postponed` status
- **AND** `main()` completes without the coverage guard throwing

#### Scenario: A dropped status fails the seed run loudly

- **WHEN** the canonical seed is modified so that no item carries a required
  status (for example `paused` is removed)
- **THEN** `assertSeedCoverage` throws and `main()` exits with a non-zero code
  instead of completing silently

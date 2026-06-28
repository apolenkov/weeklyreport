## ADDED Requirements

### Requirement: seed.ts and backfill scripts must call assertNonProdDestructive

Every destructive Prisma seed and backfill script MUST call
`assertNonProdDestructive('<scriptName>')` at the very top of its `main()` function,
before any database writes. Specifically, `prisma/seed.ts` (the Prisma-config
auto-run seed) and `prisma/backfill-policy-rules.ts` MUST add this call to match
the guard already present in every sibling script (`seed-simple.ts`, `seed-demo.ts`,
`reset-hard.ts`, `wipe-manual-uat.ts`). Without the guard these scripts write demo
users and content against whatever `DATABASE_URL` is set, including a
production-looking target.

Consumer surface: `prisma/seed.ts`, `prisma/backfill-policy-rules.ts`,
`prisma/_destructive-guard.ts` (`assertNonProdDestructive`).

#### Scenario: seed.ts refuses on a prod-looking DATABASE_URL

- **GIVEN** `DATABASE_URL` points to a database whose name matches the prod pattern
  (e.g. ends in `/customreport` with a non-local host)
- **WHEN** the Prisma auto-seed (`prisma/seed.ts`) is executed
- **THEN** `assertNonProdDestructive` throws before any row is written

#### Scenario: seed.ts proceeds on a suffixed non-prod database

- **GIVEN** `DATABASE_URL` ends in `/customreport_dev` or another valid non-prod suffix
- **WHEN** `prisma/seed.ts` runs
- **THEN** `assertNonProdDestructive` does not throw and the seed continues normally

#### Scenario: backfill-policy-rules.ts refuses on a prod-looking DATABASE_URL

- **GIVEN** `DATABASE_URL` points to a database whose name matches the prod pattern
- **WHEN** `prisma/backfill-policy-rules.ts` is executed
- **THEN** `assertNonProdDestructive` throws before any row is written

#### Scenario: backfill-policy-rules.ts proceeds on a suffixed non-prod database

- **GIVEN** `DATABASE_URL` ends in a valid non-prod suffix
- **WHEN** `prisma/backfill-policy-rules.ts` runs
- **THEN** `assertNonProdDestructive` does not throw and the backfill continues normally

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

### Requirement: \_destructive-guard docstring matches the suffix-based allow logic

The header docstring of `prisma/_destructive-guard.ts` MUST accurately
describe the implemented allow logic and MUST NOT list the Docker `postgres`
service host among hosts that are unconditionally allowed / "impossible to
reach prod through". The implemented `isTrulyLocal` check treats only
`localhost`, `127.0.0.1`, and `*.local` as unconditionally safe; the `postgres`
Docker-Compose service host is deliberately NOT treated as local and must carry
an explicit non-prod suffix (`_uat`/`_dev`/`_test`/`_local`/`_staging`). The
current "Allow rules" docstring lists `postgres (docker)` alongside the truly-local
hosts, which contradicts the code and could mislead a maintainer into thinking a
suffix-less `postgres` host is safe.

Consumer surface: `prisma/_destructive-guard.ts` (header docstring only; the
runtime logic is already correct).

#### Scenario: postgres docker host without a non-prod suffix is refused

- **GIVEN** `DATABASE_URL` whose host is `postgres` (the Docker service name) and
  whose database name lacks a non-prod suffix
- **WHEN** `assertNonProdDestructive` runs
- **THEN** it refuses, because `postgres` is not treated as truly local — matching
  the corrected docstring rather than the old "unconditionally allowed" wording

#### Scenario: docstring allow-list no longer claims postgres is unconditionally safe

- **GIVEN** a maintainer reads the `_destructive-guard.ts` header docstring
- **WHEN** they inspect the truly-local / unconditionally-allowed host list
- **THEN** `postgres (docker)` is absent from that list and is instead documented
  as requiring an explicit non-prod suffix

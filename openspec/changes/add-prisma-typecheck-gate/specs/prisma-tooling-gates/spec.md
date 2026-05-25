## ADDED Requirements

### Requirement: Prisma Scripts Must Pass a Dedicated Typecheck Gate

The repository MUST expose a dedicated typecheck task scoped to
`prisma/**/*.ts` (seeds, migration helpers, destructive guards). The
task MUST use a `tsconfig.prisma.json` that extends the root config and
restricts `include` to the `prisma/` directory. A type error in any
`prisma/**/*.ts` file MUST cause the gate to fail.

#### Scenario: Contributor breaks a seed script

- **WHEN** a contributor introduces a type error in `prisma/seed-simple.ts`
- **THEN** running `pnpm lint:prisma:typecheck` exits with a non-zero status
- **AND** the error references the offending file and line

#### Scenario: Prisma scripts are clean

- **WHEN** all `prisma/**/*.ts` files typecheck cleanly
- **THEN** running `pnpm lint:prisma:typecheck` exits with status 0

### Requirement: Aggregate Lint Task Includes the Prisma Gate

The repository-wide `pnpm lint` task MUST include the Prisma typecheck
gate. A contributor running `pnpm lint` MUST NOT be able to merge a
branch that breaks Prisma scripts even if they forgot the dedicated
command.

#### Scenario: Contributor runs the aggregate lint

- **WHEN** a contributor runs `pnpm lint` after breaking a Prisma seed
- **THEN** the aggregate task fails with the Prisma typecheck error surfaced

### Requirement: Prisma Typecheck Runs in CI

The Prisma typecheck gate MUST execute in the GitHub Actions lint
workflow on every PR that modifies any file under `prisma/`. A PR that
introduces a type error in Prisma scripts MUST be blocked from merge.

#### Scenario: PR breaks a Prisma migration helper

- **WHEN** a pull request modifies `prisma/wipe-manual-uat.ts` with a type error
- **THEN** the CI lint workflow fails
- **AND** the PR is blocked from merge until the error is fixed

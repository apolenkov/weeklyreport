## ADDED Requirements

### Requirement: pnpm lint MUST chain a Prisma-scoped typecheck pass

The aggregate `pnpm lint` task MUST chain a Prisma-scoped typecheck pass
over every `prisma/**/*.ts` file (seeds, the reset/wipe scripts, the
destructive guard). That pass MUST be `lint:prisma:typecheck`
(`tsc --project tsconfig.prisma.json --noEmit`), and `tsconfig.prisma.json`
MUST set `"include": ["prisma/**/*.ts"]` so all seven scripts are in scope.
A contributor who runs `pnpm lint` MUST NOT be able to pass the gate while
any `prisma/**/*.ts` file has a type error, even if they never run the
dedicated command directly. The GitHub Actions quality job MUST exercise
this pass by running `pnpm lint` (no separate Prisma CI step is required).

#### Scenario: a Prisma seed has a type error

- **WHEN** a contributor introduces a type error in `prisma/seed-simple.ts`
  and runs `pnpm lint`
- **THEN** the aggregate task exits non-zero with the Prisma typecheck
  error surfaced
- **AND** the error references the offending `prisma/**/*.ts` file and line

#### Scenario: all Prisma scripts typecheck cleanly

- **WHEN** every `prisma/**/*.ts` file is type-clean and `pnpm
lint:prisma:typecheck` runs
- **THEN** the command exits with status 0

#### Scenario: CI runs the Prisma pass through the aggregate lint

- **WHEN** the GitHub Actions quality job executes `pnpm lint`
- **THEN** the Prisma typecheck pass runs as one of the chained steps
- **AND** no separate Prisma-only CI step is required for coverage

### Requirement: The Prisma typecheck pass MUST fail on a dropped-model reference

The Prisma typecheck pass MUST fail when a `prisma/**/*.ts` script
references a Prisma model that no longer exists in the schema (for example
`tx.<gone>.deleteMany(...)` after the model was dropped). This is the
specific protection the removed `TODO(PRISMA-TYPECHECK-01)` marker asked
for: a dropped-model reference MUST fail the gate at lint time rather than
crash a destructive wipe at runtime.

#### Scenario: a wipe script references a dropped model

- **WHEN** `prisma/wipe-manual-uat.ts` calls
  `tx.nonExistentModel.deleteMany({})` for a model absent from the schema
- **THEN** `pnpm lint:prisma:typecheck` exits non-zero with a TypeScript
  `error TS2339` naming the missing property
- **AND** `pnpm lint` fails for the same reason

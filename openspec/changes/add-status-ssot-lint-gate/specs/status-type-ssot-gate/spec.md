# status-type-ssot-gate Delta

## ADDED Requirements

### Requirement: Status literal-union re-declarations are gated

The repository MUST run a scanner (`scripts/find-status-literal-unions.mjs`)
that fails when a TypeScript union type or `z.enum` literal list outside the
SSOT file re-declares either status vocabulary: a literal set containing all
three of `"green"`, `"yellow"`, `"red"` (extras allowed — the three colors
only ever come from `TrafficLightStatus`), or a status-literal set equal to
exactly `{"draft", "published"}` (supersets are distinct vocabularies by
traced evidence and stay a review judgment). The scanner MUST cover test
files. The only exemptions are the SSOT file itself
(`packages/shared/src/schemas/report-primitives.schema.ts`) and the
documented literal mirror `prisma/seed-constants.ts`, hardcoded centrally in
the scanner; there is no inline annotation escape.

#### Scenario: a full traffic-light union is re-declared

- **WHEN** a staged source or test file declares a union or `z.enum`
  containing `"green"`, `"yellow"`, and `"red"` outside the SSOT file
- **THEN** the scanner exits non-zero naming the file and line
- **AND** the commit is blocked by lint-staged

#### Scenario: an exact report-status union is re-declared

- **WHEN** a staged file declares a union whose status-literal set is exactly
  `{"draft", "published"}` outside the SSOT file and `prisma/seed-constants.ts`
- **THEN** the scanner exits non-zero naming the file and line

#### Scenario: legal compositions pass

- **WHEN** a file composes from the shared types (`TrafficLightStatus |
"empty"`), declares a color subset (`"yellow" | "red"`), or declares a
  distinct vocabulary that merely includes `"draft"` and `"published"` among
  other lifecycle literals
- **THEN** the scanner reports nothing

### Requirement: The gate is wired into both lint paths

The scanner MUST run from lint-staged on every staged `.ts`/`.tsx` file
(including tests) and from the root `lint` composite as a repo-wide `--all`
sweep (`lint:status-literal-unions`), so hook bypasses and rebases cannot
land violations silently.

#### Scenario: commit-time gating

- **WHEN** a commit stages a `.ts`/`.tsx` file
- **THEN** lint-staged runs the scanner on the staged paths

#### Scenario: sweep-time gating

- **WHEN** `pnpm lint` runs
- **THEN** the scanner sweeps the whole tree via `--all` and fails the
  composite on any hit

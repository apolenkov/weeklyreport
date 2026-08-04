# status-type-ssot-gate Specification

## Purpose

Prevent re-declaration of canonical status and role literal vocabularies with a syntax-tree gate enforced by both staged and repository-wide lint paths.

## Requirements

### Requirement: Status literal-union re-declarations are gated

The repository MUST run a gate (`scripts/status-ssot-gate.ts`) that fails when
a TypeScript union type or zod literal list outside the allowlisted files
re-declares any of four vocabularies: a literal set containing all three of
`"green"`, `"yellow"`, `"red"` (extras allowed — the three colors only ever
come from `TrafficLightStatus`), a status-literal set equal to exactly
`{"draft", "published"}` (supersets are distinct
vocabularies by traced evidence and stay a review judgment), a literal set
containing all four of `"blocked"`, `"at-risk"`, `"on-track"`, `"empty"`
(extras allowed — the canonical presentation vocabulary is declared once as
`CanonicalStatus`; subsets like `riskSeveritySchema`'s `at-risk`/`blocked`
stay legal), or a literal set containing all four of `"lead"`, `"head"`,
`"admin"`, `"viewer"` (extras allowed — the role vocabulary is declared once
per axis as `Role`/`DbRole`, per the `role-type` spec's own exemptions:
runtime validators/presentation-ordered lists enumerating VALUES while
typing from shared, the Prisma seed toolchain's one commented literal
mirror, the plain-Node catalog parser mirror, and catalog YAML).

The gate MUST cover test files. The only exemptions are the SSOT files
themselves (`packages/shared/src/schemas/report-primitives.schema.ts`,
`packages/shared/src/schemas/canonical-status.ts`,
`packages/shared/src/schemas/auth.ts`), the documented literal mirror
`prisma/seed-constants.ts`, the presentation-order list
`apps/web/src/shared/ui/role-switcher.tsx`, and the plain-Node catalog mirror
`e2e/sweep/catalog-parser.ts` — all hardcoded centrally in the gate, with no
inline annotation escape.

The gate DOES walk `e2e/**` (a union planted there is reported). Its one
allowlisted role mirror, `e2e/sweep/catalog-parser.ts`, is an `as const` value
list required by the plain-Node entrypoint compiled under the root
`tsconfig.scripts.json`, whose `paths` is deliberately empty because Node
resolves imports itself. Every other e2e reader takes the vocabulary from that
parser or from `@customreport/shared`.

The matching MUST be over the syntax tree rather than source text, and MUST
run with inline configuration disabled so no comment can suppress a verdict; a
file the gate cannot parse or does not lint MUST fail rather than pass. The
syntax-tree requirement is what keeps fixture source inside string literals
(the gate's own test file declares vocabularies that way) from being read as
declarations, which a text scan cannot distinguish.

#### Scenario: a full traffic-light union is re-declared

- **WHEN** a staged source or test file declares a union or zod literal list
  containing `"green"`, `"yellow"`, and `"red"` outside the SSOT file
- **THEN** the gate exits non-zero naming the file and line
- **AND** the commit is blocked by lint-staged

#### Scenario: an exact report-status union is re-declared

- **WHEN** a staged file declares a union whose status-literal set is exactly
  `{"draft", "published"}` outside the SSOT file and `prisma/seed-constants.ts`
- **THEN** the gate exits non-zero naming the file and line

#### Scenario: the canonical presentation vocabulary is re-declared

- **WHEN** a staged file declares a union or zod literal list containing
  `"blocked"`, `"at-risk"`, `"on-track"`, and `"empty"` outside
  `packages/shared/src/schemas/canonical-status.ts`
- **THEN** the gate exits non-zero naming the file and line

#### Scenario: the role vocabulary is re-declared

- **WHEN** a staged file declares a union or zod literal list containing
  `"lead"`, `"head"`, `"admin"`, and `"viewer"` outside
  `packages/shared/src/schemas/auth.ts` or the `role-type` spec's other
  named exemptions
- **THEN** the gate exits non-zero naming the file and line

#### Scenario: legal compositions pass

- **WHEN** a file composes from the shared types (`TrafficLightStatus |
"empty"`, an alias of `CanonicalStatus`, `Role | null`), declares a subset
  (`"yellow" | "red"`, `"at-risk" | "blocked"`), or declares a distinct
  vocabulary that merely includes `"draft"` and `"published"` among other
  lifecycle literals
- **THEN** the gate reports nothing

#### Scenario: an inline disable cannot suppress a verdict

- **WHEN** a violating file carries `/* eslint-disable */`, an
  `eslint-disable-next-line`, or a rule-specific disable over the declaration
- **THEN** the gate still exits non-zero naming the file and line

### Requirement: The gate is wired into both lint paths

The gate MUST run from lint-staged on every staged `.ts`/`.tsx` file
(including tests) and from the root `lint` composite as a repo-wide `--all`
sweep (`lint:ssot-gate`), so hook bypasses and rebases cannot
land violations silently.

#### Scenario: commit-time gating

- **WHEN** a commit stages a `.ts`/`.tsx` file
- **THEN** lint-staged runs the gate on the staged paths

#### Scenario: sweep-time gating

- **WHEN** `pnpm lint` runs
- **THEN** the gate sweeps the whole tree via `--all` and fails the
  composite on any hit

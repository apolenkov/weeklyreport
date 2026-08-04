## ADDED Requirements

### Requirement: Aggregate lint runs every owned quality surface with zero warnings

The root `pnpm lint` gate MUST execute every declared lint owner, including ESLint,
Stylelint, all repository TypeScript lint projects, SSOT and scope checks, dependency
cruiser, Knip, formatter verification, type-coverage, marker checks, and the exemplary
inventory validators. The aggregate runner MUST execute all configured checks, report
every failure, and exit nonzero when any owner emits an error or warning.

#### Scenario: One owner emits only a warning

- **WHEN** ESLint or Stylelint reports a warning and no errors
- **THEN** its zero-warning invocation exits nonzero
- **AND** the aggregate `pnpm lint` table reports that owner as failed

#### Scenario: Several owners fail

- **WHEN** two or more lint owners fail in the same run
- **THEN** the non-fail-fast aggregate executes the remaining owners
- **AND** reports each failed owner before exiting nonzero

### Requirement: Prettier checks every maintained supported file

`pnpm format:check` and the Prettier step owned by the aggregate quality gate MUST
derive their scope from the maintained worktree rather than a hand-maintained subset.
Every Prettier-supported tracked or non-ignored untracked file MUST be checked unless
it is generated, vendored, binary, or explicitly unsupported, with each exclusion
classified and tested by the scope validator.

#### Scenario: A newly added supported file is misformatted

- **WHEN** a contributor adds a non-ignored Prettier-supported file outside the
  historically enumerated source roots with non-canonical formatting
- **THEN** `pnpm format:check` exits nonzero
- **AND** the scope validator confirms that the path was checked

#### Scenario: An ignore entry hides maintained source

- **WHEN** `.prettierignore` or command scoping excludes a maintained supported file
- **THEN** the formatter scope probe exits nonzero
- **AND** the exclusion cannot be accepted without correcting its classification

### Requirement: Tool ownership remains non-overlapping and observable

Each quality concern MUST have one named primary owner, and the lint-gate result MUST
identify that owner and its exact command. TypeScript remains the type-correctness
owner, ESLint the TS/JS semantic-lint owner, Stylelint the CSS-lint owner, and Prettier
the formatting owner. A green command from one owner MUST NOT satisfy another owner's
requirement.

#### Scenario: Formatting passes while typecheck fails

- **WHEN** Prettier accepts a TypeScript file containing a type error
- **THEN** the TypeScript owner still fails the aggregate gate
- **AND** formatting success is not reported as type-correctness evidence

## ADDED Requirements

### Requirement: Every maintained repository test MUST have one executable owner

Every tracked `*.test.*` or `*.spec.*` file outside ordinary workspace test
discovery MUST be included by exactly one explicit repository-test manifest or
runner executed by `pnpm lint` or `pnpm test`. Knip entry classification, type
checking, and direct ad-hoc execution MUST NOT count as test execution evidence.
The discovery validator MUST compare tracked tests to configured runners and fail
for missing, duplicate, or stale ownership.

#### Scenario: A Node test is not named by a gate

- **WHEN** a maintained `scripts/**/*.test.ts` file is absent from every normal aggregate runner
- **THEN** the repository-test discovery validator fails with its path
- **AND** a green Knip or TypeScript run cannot satisfy the test requirement

#### Scenario: Every repository test executes once

- **WHEN** the aggregate lint gate runs
- **THEN** every manifest-owned repository test is executed by its declared Node test command
- **AND** the result table identifies the owning concern and exact command

### Requirement: Stable command names MUST survive internal tooling relocation

Root package command names used by contributors, hooks, Docker, or CI MUST remain
stable while internal paths move. Each command MUST resolve to one concern-owned
entrypoint; old path aliases MUST NOT persist as duplicate implementations.

#### Scenario: The lint orchestrator moves

- **WHEN** the lint orchestrator is relocated below a concern directory
- **THEN** `pnpm lint` still executes the same complete non-fail-fast check set
- **AND** the package command points at the single new entrypoint

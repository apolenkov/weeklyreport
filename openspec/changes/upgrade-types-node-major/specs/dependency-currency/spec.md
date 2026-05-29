# dependency-currency

## ADDED Requirements

### Requirement: Node Type Definitions MUST Track The Runtime Major

The `@types/node` major version declared in the workspace MUST be at or below
the Node major the project actually runs (as established by `.nvmrc` and the CI
`NODE_VERSION`), and MUST NOT be declared ahead of that runtime major without a
recorded justification. When `@types/node` is declared in more than one
workspace, all declarations MUST share the same major.

#### Scenario: Types are brought up to the runtime major

- **WHEN** `@types/node` is bumped to `^25.9.1` in root `package.json` and
  `apps/web/package.json`
- **THEN** the declared major (25) is confirmed to be at or below the Node major
  in `.nvmrc` (`25`) and CI `NODE_VERSION` (`25`)
- **AND** both workspace declarations are on the same `@types/node` major

#### Scenario: Types are never ahead of the runtime without justification

- **WHEN** an `@types/node` major bump is proposed
- **THEN** the bump is rejected if its major exceeds the Node major run by
  `.nvmrc` and CI, unless the proposal records an explicit justification for
  running types ahead of the runtime

#### Scenario: Runtime guardrails are not changed by a types-only bump

- **WHEN** the `@types/node` major is bumped for alignment
- **THEN** `engines.node`, `.nvmrc`, and the CI `NODE_VERSION` are left
  unchanged by that bump
- **AND** any remaining mismatch between the `engines.node` floor and the
  runtime major is recorded rather than silently edited

### Requirement: A Major Type Bump MUST Pass The Full Gate Suite

A major upgrade of `@types/node` MUST be validated by the full gate suite on the
target Node major before it is considered complete, and type-level breakages
MUST be resolved with real fixes rather than `any`.

#### Scenario: Gates run on the target runtime

- **WHEN** the `@types/node` major bump is applied and the lockfile refreshed
- **THEN** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass
  while running on Node 25

#### Scenario: Type breaks are fixed, not widened

- **WHEN** the bump surfaces a changed or removed Node typing during typecheck
- **THEN** the break is resolved at the call site or with a documented local
  type assertion
- **AND** it is NOT silenced by widening the affected value to `any`

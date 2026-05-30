# code-quality-tooling Specification

## Purpose

TBD - created by archiving change migrate-to-biome. Update Purpose after archive.

## Requirements

### Requirement: Biome Owns Lint And Format For The Code Surface

The repository MUST use Biome (via a single root `biome.json`) as the primary
lint and format tool for the code surface — `*.{ts,tsx,js,jsx,mjs}`,
`*.{json,jsonc}`, and `*.css`. The `pnpm lint` gate and the `lint-staged`
pre-commit path MUST exercise Biome over these files. The Biome lint pass MUST
run once as a single root invocation, not duplicated per package.

#### Scenario: Developer runs the lint gate

- **WHEN** `pnpm lint` runs on a clean tree
- **THEN** Biome lints + format-checks the code surface
- **AND** the gate also runs the residual ESLint pass and
  `lint:prisma:typecheck`
- **AND** the command exits 0 with no findings

#### Scenario: Pre-commit formats staged code via Biome

- **WHEN** a staged `*.ts` file has a fixable formatting or lint issue
- **THEN** the `lint-staged` step runs `biome check --write` and fixes it
  before the commit completes

#### Scenario: Biome runs as one root pass

- **WHEN** the lint gate executes
- **THEN** Biome lints the code surface in a single root invocation against the
  one `biome.json`
- **AND** the same Biome pass is not also re-run per package
- **AND** any tree-wide format adoption changes only formatting / autofixable
  lint, never logic, strings, or exports

### Requirement: A Residual ESLint Config Preserves Rules Biome Cannot Replace

The repository MUST retain a minimal ESLint configuration for the rules with no
stable Biome equivalent: `react-compiler/react-compiler`,
`react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`,
`@typescript-eslint/no-floating-promises`, and the AI-module
`no-restricted-syntax` logger-secrets selector. These guarantees MUST NOT be
weakened or silently dropped during the Biome migration.

#### Scenario: React Compiler enforcement survives the migration

- **WHEN** code violates the React Compiler rule after Biome is adopted
- **THEN** the residual ESLint pass reports `react-compiler/react-compiler` as
  an error
- **AND** `pnpm lint` fails

#### Scenario: The AI logger-secrets guard survives the migration

- **WHEN** a file under `apps/api/src/modules/ai/**` passes `prompt`,
  `messages`, or `response` into a `logger.*` call
- **THEN** the residual ESLint `no-restricted-syntax` rule flags it as an error
- **AND** the `ai-module-facade` secret-logging invariant remains enforced

#### Scenario: no-floating-promises stays a hard error

- **WHEN** a floating promise is introduced after Biome is adopted
- **THEN** the residual type-aware ESLint rule reports it as an error
- **AND** the rule is NOT delegated to Biome's experimental nursery
  `noFloatingPromises`

### Requirement: The AI Prisma-Isolation Import Rule Ports To Biome

Biome MUST enforce the AI-module isolation rule that bans direct Prisma client
imports outside the facade boundary. The rule MUST live in `biome.json` as a
`noRestrictedImports` override scoped to `apps/api/src/modules/ai/**`, excluding
the facade files (`ai-facade.ts`, `ai-cache.ts`, `ai-authz.ts`) and
tests/fixtures.

#### Scenario: A raw Prisma import outside the facade is rejected

- **WHEN** a non-facade file under `apps/api/src/modules/ai/**` imports
  `@prisma/client` directly
- **THEN** Biome's `noRestrictedImports` rule flags it with the module-isolation
  message
- **AND** the facade files and AI test/fixture files remain exempt

### Requirement: Markdown And YAML Keep Dedicated Tooling

The repository MUST keep `markdownlint-cli2` for Markdown linting and a residual
non-Biome formatter for YAML files, because Biome has no stable Markdown
lint/format and no stable YAML formatter. The Markdown tooling (`lint:md` /
`lint:md:fix`, `.markdownlint.json`) and the YAML formatter step MUST NOT be
folded into Biome.

#### Scenario: Markdown lint is unchanged

- **WHEN** `pnpm lint:md` runs
- **THEN** `markdownlint-cli2` lints the configured Markdown set exactly as
  before the Biome migration
- **AND** the CI `lint-md` job continues to invoke it

#### Scenario: YAML formatting keeps a working formatter

- **WHEN** a `*.yml` or `*.yaml` file is staged with a formatting issue
- **THEN** the residual (non-Biome) YAML formatter step in `lint-staged`
  formats it
- **AND** Biome is not relied on to format YAML

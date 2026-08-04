# lint-toolchain-ownership Specification

## Purpose

Assign logic linting to ESLint, formatting to Prettier, CSS linting to stylelint, and Prisma script typechecking to a scoped tsc pass in the aggregate gate.

## Requirements

### Requirement: ESLint owns react-compiler, no-floating-promises, and react-hooks

The ESLint config (`eslint.config.ts`) MUST own these checks in the lint gate:
`react-compiler/react-compiler`, the type-aware
`@typescript-eslint/no-floating-promises`, and `react-hooks/rules-of-hooks` +
`react-hooks/exhaustive-deps`. None has a stable owner outside ESLint, so the
ESLint pass MUST stay in the gate. (The former AI logger-secrets
`no-restricted-syntax` selector was removed with the AI module in `45ffbe23` and
is no longer part of this set.)

#### Scenario: ESLint enforces these checks in the lint gate

- **WHEN** `pnpm lint` runs
- **THEN** `eslint .` executes (no `biome check` step exists)
- **AND** a floating promise, a hook-rule violation, or a react-compiler
  violation fails the gate via ESLint

### Requirement: React hook rules are single-owned by ESLint

React hook correctness MUST be reported only once, by ESLint's
`react-hooks/rules-of-hooks` (at `error`) and `react-hooks/exhaustive-deps` (at
`error`). With Biome removed, single ownership is structural — there is no second
tool to disable. No Biome `useExhaustiveDependencies` / `useHookAtTopLevel`
configuration remains, because `biome.json` no longer exists.

#### Scenario: hook violation is reported once

- **WHEN** a component reads a reactive value missing from a `useEffect`
  dependency array
- **THEN** ESLint reports `react-hooks/exhaustive-deps`
- **AND** no second tool reports the same concern (Biome is not installed)

### Requirement: Type-checking is not owned by the lint toolchain

Type-checking MUST remain a separate gate (`pnpm typecheck` via `tsc`). Neither
Biome nor ESLint is responsible for full type-checking, and enabling Biome's
recommended ruleset MUST NOT be treated as a substitute for `tsc`.

#### Scenario: typecheck remains a distinct gate

- **WHEN** the quality gates run
- **THEN** `pnpm typecheck` runs independently of `pnpm lint`
- **AND** a type error is caught by `tsc`, not by `biome check` or `eslint`

### Requirement: Markdown is formatted, not linted

The system MUST format Markdown with Prettier and MUST NOT lint it. The
lint-staged `*.md` entry MUST run `prettier --write` (the same treatment as
`*.{yml,yaml}`), and markdownlint MUST be removed entirely: no
`markdownlint-cli2` dependency, no `.markdownlint.json`, and no `lint:md` /
`lint:md:fix` scripts. Dropping markdownlint intentionally forgoes its
structural checks; Markdown is a background-formatted artifact and MUST NOT
block a commit with lint errors.

#### Scenario: markdown is auto-formatted on commit

- **WHEN** a contributor commits a `*.md` file with non-canonical formatting
- **THEN** the lint-staged `*.md` hook runs `prettier --write` and normalizes it
- **AND** no markdownlint error is produced (markdownlint is not installed)

#### Scenario: no markdownlint surface remains

- **WHEN** the repository tooling is inspected
- **THEN** `package.json` contains no `markdownlint-cli2` dependency and no
  `lint:md`/`lint:md:fix` scripts
- **AND** no `.markdownlint.json` file exists
- **AND** Prettier remains the owner of both `*.{yml,yaml}` and `*.md`

### Requirement: ESLint owns the logic lint surface

ESLint (`eslint.config.ts`) MUST own the full logic lint surface for
`*.{ts,tsx,js,jsx,mjs}`, absorbing Biome's former `recommended` coverage 1:1 via
mainstream plugins: `@typescript-eslint` (individual rules, NOT the
`recommended`/`strictTypeChecked` arrays — those would smuggle rules Biome did
not enforce), `eslint-plugin-react`, `eslint-plugin-jsx-a11y`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-compiler`, and
`eslint-plugin-unused-imports`. The repo-specific overrides MUST be preserved at
their Biome severities: `@typescript-eslint/no-explicit-any` at `error`,
`@typescript-eslint/no-non-null-assertion` at `error`, and unused-variable
enforcement at `error` (via `unused-imports/no-unused-vars` with
`ignoreRestSiblings` and a leading-underscore ignore pattern). The type-aware
`@typescript-eslint/no-floating-promises` MUST remain at `error` with the
`projectService` machinery intact. Biome MUST NOT be reintroduced for this
surface.

#### Scenario: recommended-equivalent surface fails the gate

- **WHEN** `pnpm lint` runs `eslint .`
- **THEN** a file using `any` is reported at `error` via
  `@typescript-eslint/no-explicit-any`
- **AND** a floating promise, an unused variable, a react-compiler violation, or
  a Biome-recommended-equivalent React violation
  (`react/no-array-index-key`, `react/no-danger`) fails the gate
- **AND** the gate runs no `biome check` step

#### Scenario: jsx-a11y net-new firers are turned off to preserve 1:1

- **WHEN** the jsx-a11y `recommended` preset reports a rule Biome did not
  enforce (`jsx-a11y/no-noninteractive-element-interactions`,
  `jsx-a11y/label-has-associated-control`)
- **THEN** that specific rule is set to `off` in `eslint.config.ts` with an
  inline rationale tying it to Biome 2.4.16 behavior
- **AND** no rule Biome DID enforce is disabled to force the gate green

### Requirement: Prettier owns code-surface formatting

Prettier MUST be the formatter of record for the entire code surface
(`*.{ts,tsx,js,jsx,mjs}`, `*.{json,jsonc}`, `*.css`) in addition to the
`*.{yml,yaml,md}` it already owned. `.prettierrc.json` MUST mirror the former
Biome formatter block (`printWidth: 80`, `tabWidth: 2`, `useTabs: false`,
`semi: true`, `singleQuote: false`, `trailingComma: "all"`), and
`.prettierignore` MUST mirror the former `biome.json` exclusions. `pnpm format`
MUST run `prettier --write .` and `pnpm format:check` MUST run
`prettier --check .`. `biome format` MUST NOT appear in any script.

#### Scenario: prettier is the single code formatter

- **WHEN** `pnpm format:check` runs
- **THEN** `prettier --check .` evaluates the TS/JS/JSON/CSS surface
- **AND** a non-canonically formatted source file fails the check
- **AND** no `biome format` invocation exists in `package.json`

### Requirement: stylelint owns CSS lint

stylelint MUST own lint for the CSS files (`stylelint-config-standard` plus a
Tailwind at-rule/directive allowance), replacing Biome's built-in CSS lint
rather than dropping it. The two CSS rules Biome enforced MUST be preserved at
`warning` severity (`no-descending-specificity`, `declaration-no-important`).
`pnpm lint` MUST invoke `stylelint "**/*.css" --allow-empty-input`. Prettier
remains the CSS formatter.

#### Scenario: stylelint runs in the lint gate

- **WHEN** `pnpm lint` runs
- **THEN** `stylelint "**/*.css" --allow-empty-input` executes
- **AND** a Tailwind directive (`@tailwind`, `@apply`, `@theme`) does not
  produce an `at-rule-no-unknown` error
- **AND** the two Biome-carried CSS rules report at `warning`, not `error`

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

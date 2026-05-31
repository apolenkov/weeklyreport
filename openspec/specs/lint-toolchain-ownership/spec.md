# lint-toolchain-ownership Specification

## Purpose

TBD - created by archiving change enable-biome-recommended-ruleset. Update Purpose after archive.

## Requirements

### Requirement: ESLint owns the rules Biome cannot provide

A residual ESLint config (`eslint.config.ts`) MUST remain in the lint gate to
own the three checks Biome cannot stably provide: `react-compiler/react-compiler`
(no Biome equivalent), the type-aware `@typescript-eslint/no-floating-promises`,
and `react-hooks/rules-of-hooks` + `react-hooks/exhaustive-deps`. ESLint MUST
NOT be removed while any of these three checks lacks a stable Biome owner. (The
former AI logger-secrets `no-restricted-syntax` selector was removed with the AI
module in `45ffbe23` and is no longer part of this set.)

#### Scenario: ESLint still runs in the lint gate

- **WHEN** `pnpm lint` runs
- **THEN** `eslint .` executes after `biome check .`
- **AND** a floating promise, a hook-rule violation, or a react-compiler
  violation fails the gate via ESLint

### Requirement: React hook rules are single-owned by ESLint

React hook correctness MUST be reported only once, by ESLint's
`react-hooks/rules-of-hooks` (at `error`) and `react-hooks/exhaustive-deps` (at
`warn`). With Biome removed, single ownership is structural — there is no second
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
`@typescript-eslint/no-non-null-assertion` at `warn`, and unused-variable
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

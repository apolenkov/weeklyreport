# lint-toolchain-ownership Specification (delta)

This delta supersedes the Biome-ownership requirements of the
`lint-toolchain-ownership` spec with the equivalent ESLint + Prettier +
stylelint ownership that landed on `feat/lint-swap-eslint-prettier`
(Phase 1 of `migrate-lint-to-eslint-prettier`). The swap is a
behavior-preserving 1:1 port — **no new lint rules** — so every removed Biome
requirement is replaced by an equivalent, except where the Biome rule has no
mainstream ESLint counterpart in Phase 1 (documented inline and deferred to the
Phase 2 strictness declaration).

## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Biome owns the recommended lint ruleset

**Reason**: Biome was removed in Phase 1. `biome.json` is deleted and
`@biomejs/biome` is dropped from dependencies. The recommended lint surface and
the repo overrides are now owned by ESLint (see the ADDED "ESLint owns the logic
lint surface" requirement), and formatting moved to Prettier (see "Prettier owns
code-surface formatting").

**Migration**: The 1:1 Biome→ESLint rule map and the per-site
`biome-ignore → eslint-disable-next-line` conversion (73 sites; 6
`useSemanticElements` suppressions DROPped as having no jsx-a11y equivalent) are
recorded in the `migrate-lint-to-eslint-prettier` change artifacts.

### Requirement: Cognitive complexity is a non-blocking visibility target

**Reason**: `complexity/noExcessiveCognitiveComplexity` is a Biome rule with no
mainstream ESLint counterpart in the Phase-1 plugin set (it is listed in the
change's `rule-map.json` `noEquivalent`). It ran at non-gating `warn`, so its
removal does not change which diagnostics blocked the lint gate — the
behavior-preserving guarantee holds.

**Migration**: Cognitive-complexity visibility is deferred to the Phase 2
strictness declaration, where `eslint-plugin-sonarjs`
(`sonarjs/cognitive-complexity`) reintroduces an equivalent target.

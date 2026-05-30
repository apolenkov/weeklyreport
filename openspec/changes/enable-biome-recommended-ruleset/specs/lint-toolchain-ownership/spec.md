## ADDED Requirements

### Requirement: Biome owns the recommended lint ruleset

The root `biome.json` linter MUST enable Biome's `recommended` ruleset
(`linter.rules.recommended: true`). Biome MUST own formatting and the full
recommended lint surface for the code surface it already covers
(`*.{ts,tsx,js,jsx,mjs}`, `*.{json,jsonc}`, `*.css`). Repo-specific overrides
(`noExplicitAny: error`, `noNonNullAssertion: warn`, `noUnusedVariables: error`
with `ignoreRestSiblings`) MUST be preserved on top of the recommended baseline,
not replaced by it.

#### Scenario: recommended ruleset is enabled

- **WHEN** `pnpm lint` runs `biome check .`
- **THEN** `biome.json` resolves `linter.rules.recommended` to `true`
- **AND** a recommended-rule violation (e.g. `style/useImportType`) in any
  non-excluded source file fails the lint gate

#### Scenario: repo overrides survive the recommended baseline

- **WHEN** Biome evaluates a file that uses `any`
- **THEN** `noExplicitAny` is reported at `error` (override retained)
- **AND** an unused variable is still reported at `error` via the retained
  `noUnusedVariables` override (not relaxed to the recommended default)

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

The system MUST disable Biome's `correctness/useExhaustiveDependencies` and
`correctness/useHookAtTopLevel` in `biome.json` so React hook correctness is
reported only once, by ESLint's `react-hooks/exhaustive-deps` and
`react-hooks/rules-of-hooks`. No hook concern MUST be reported by both tools
simultaneously.

#### Scenario: hook violation is reported once

- **WHEN** a component reads a reactive value missing from a `useEffect`
  dependency array
- **THEN** ESLint reports `react-hooks/exhaustive-deps`
- **AND** Biome does not also report `useExhaustiveDependencies` (rule disabled)

### Requirement: Cognitive complexity is a non-blocking visibility target

`complexity/noExcessiveCognitiveComplexity` MUST be enabled at severity `warn`
with `maxAllowedComplexity: 15`. It MUST NOT fail the lint gate. Escalation to
`error` and the refactoring of the functions it surfaces are out of scope for
this capability and belong to a separate architecture change.

#### Scenario: over-complex function warns but does not block

- **WHEN** `biome check .` evaluates a function whose cognitive complexity
  exceeds 15
- **THEN** Biome emits a `warn`-level `noExcessiveCognitiveComplexity` diagnostic
- **AND** the lint gate still exits `0` on that diagnostic alone

### Requirement: Type-checking is not owned by the lint toolchain

Type-checking MUST remain a separate gate (`pnpm typecheck` via `tsc`). Neither
Biome nor ESLint is responsible for full type-checking, and enabling Biome's
recommended ruleset MUST NOT be treated as a substitute for `tsc`.

#### Scenario: typecheck remains a distinct gate

- **WHEN** the quality gates run
- **THEN** `pnpm typecheck` runs independently of `pnpm lint`
- **AND** a type error is caught by `tsc`, not by `biome check` or `eslint`

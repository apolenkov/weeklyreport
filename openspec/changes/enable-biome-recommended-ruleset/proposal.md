## Why

The Biome migration (`4d7ad5e7`) landed with `recommended: false` and only four
hand-picked rules, even though its own commit message claimed "strict lint
rules". That gap was a deliberate landing tactic — the full recommended ruleset
flags ~550 findings, which would have blocked a green-gate big-bang reformat —
but it was never recorded as a decision, so the config reads as accidental
under-enforcement. Engineers (and AI contributors) currently ship code that
Biome's recommended ruleset would reject. This change turns the implied
"ratchet up later" into an explicit, recorded standard and flips the switch.

## What Changes

- `biome.json` linter: `recommended: false` → **`recommended: true`** (big-bang,
  a single landing commit, gate green at the end — mirroring how Biome itself
  landed).
- **Disable** Biome `useExhaustiveDependencies` (14 findings) and
  `useHookAtTopLevel` (1) — ESLint stays the sole owner of React hook rules
  ("ESLint must run anyway" for the rules below), avoiding double-reporting.
- **Enable** `complexity/noExcessiveCognitiveComplexity` at **`warn`**,
  `maxAllowedComplexity: 15` (surfaces 65 functions) — a non-blocking visibility
  target. The refactor and escalation to `error` are **deferred to a separate
  architecture change** (`improve-codebase-architecture` driven), not this one.
- Preserve existing overrides: AI-module `noRestrictedImports` Prisma-isolation,
  `noExplicitAny: error`, `noNonNullAssertion: warn`.
- Record the **tool-ownership boundary** as a durable invariant so the residual
  ESLint config is no longer mistaken for dead weight.

## Non-goals

- **Removing ESLint.** It stays a thin residual for rules Biome cannot do:
  `react-compiler` (no Biome rule), type-aware `no-floating-promises`,
  `react-hooks`, and the AI logger-secrets `no-restricted-syntax` selector.
- **Replacing `tsc`.** Type-checking is a separate axis Biome never owned.
- **Cognitive-complexity refactoring** (the 65 functions) — that is change B.
- **Executing the flip + fixes.** This change records the plan and contract;
  the actual `recommended: true` flip and the ~535 fixes are a separate session.

## Capabilities

### New Capabilities

- `lint-toolchain-ownership`: which tool owns which class of check — Biome
  (format + recommended lint + cognitive-complexity warn target), ESLint (the
  four irreducible rules), `tsc` (type-checking) — and the rule that overlaps
  must not be double-owned.

### Modified Capabilities
<!-- none: no existing lint/quality spec to modify -->

## Impact

- `biome.json` (the flip + two disabled hook rules + cognitive-complexity warn).
- ~535 findings fixed in the landing commit: ≤429 safe-autofix via
  `biome check --write` (unsafe fixes applied selectively with review), ~94 a11y
  hand-fixed at `error` (English strings per repo rule), ~12 other manual.
- `eslint.config.ts` comment updated to point at the new durable spec.
- No runtime, schema, or API behavior changes — lint/format only.

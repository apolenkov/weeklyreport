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

## Grill findings — 2026-05-30

Adversarial review against the live tree (`biome.json` v2.4.16,
`eslint.config.ts`, AI-removal commit `45ffbe23`).

**Verdict: needs-revision.** The plan's shape (big-bang `recommended: true`,
ESLint stays for the irreducible rules, a11y now / cognitive-complexity later)
is sound and currentState is honestly not-started. But the spec delta and
proposal still reference an AI-module rule set that no longer exists, so the
spec is unsatisfiable as written and `openspecDelta` is NOT "none".

- **[major] Stale AI-module references make the spec unsatisfiable.** The AI
  backend was removed in `45ffbe23` (same day as this change). Consequences:
  - `biome.json` has **no** `noRestrictedImports` AI override — so task 1.4
    ("confirm AI-module `noRestrictedImports` intact") and proposal What-Changes
    line 24 ("Preserve … AI-module `noRestrictedImports` Prisma-isolation")
    point at a rule that is gone.
  - `spec.md` Req 1 lists that override among "overrides to preserve" and its
    scenario asserts it "still applies to `apps/api/src/modules/ai/**`" — there
    is no AI code (only `HANDOFF.md`) and no rule, so the scenario can never
    pass.
  - `spec.md` Req 2 says ESLint owns "the **four** checks" incl. the AI
    logger-secrets `no-restricted-syntax` selector. The live `eslint.config.ts`
    has **three** rule families (`no-floating-promises`, `react-hooks/*`,
    `react-compiler`); the selector was removed and the header comment already
    says so. Spec must read "three".
  - `design.md` Risks (lines 90–93) already acknowledge the AI removal — so the
    proposal + spec lag behind design, an internal inconsistency. Fix before
    implementation: drop AI refs from proposal line 24, task 1.4, spec Reqs
    1 & 2; change "four" → "three".

- **[major] Live override count is THREE, not "four hand-picked rules".**
  `biome.json` linter today: `noExplicitAny: error`, `noNonNullAssertion: warn`,
  `noUnusedVariables: error` (`ignoreRestSiblings`). Proposal/design say "four";
  task 1.4 also omits `noUnusedVariables`. Adjust the intact-overrides list.

- **[minor] Explorer's "markdown-format-only is not a dependency / both
  independent" is wrong for spec coherence.** `markdown-format-only` MODIFIES
  the `lint-toolchain-ownership` capability that THIS change ADDS; its proposal
  states the capability "is introduced by enable-biome-recommended-ruleset".
  So md-format cannot be spec-synced/archived until this change lands. The edge
  points md-format → enable-biome (a property of md-format's dependsOn), so this
  change's own `dependsOn` correctly stays `[]`. It is a spec-archival ordering
  constraint, not a code-execution one (they share only `CLAUDE.md` in the
  tree).

- **[minor] Shared-file / parallel-worktree collisions.** This change edits
  `biome.json`, `eslint.config.ts`, `CLAUDE.md`, and the source tree; it does
  NOT edit `package.json`, `pnpm-lock.yaml`, or `turbo.json` (the explorer's
  5-file list overstates collisions). Real collisions: `biome.json` shared with
  `migrate-to-biome` (which also writes `biome.json`, incl. its own — now stale
  — AI `noRestrictedImports` task), and `CLAUDE.md` shared with
  `markdown-format-only`. None of the three biome-touching changes can run as
  parallel git worktrees.

- **[info] gatesSufficient = false stands.** A big-bang `recommended: true`
  flip with ~535 fixes (≤429 autofix + ~94 a11y hand-fixes + `--unsafe` fixes
  that can alter semantics) needs diff-scale human review on top of
  typecheck/lint/test/build — the gates prove green, not correct.

- **[info] Finding counts predate AI removal.** The ~550/~535 measurement was
  taken before `45ffbe23`; the mock-only AI surface was small, so drift is
  minor, but the execution session should re-measure `biome check . --write`
  rather than trust the recorded counts.

**Revised recommendation: finish the openspec artifacts first** (drop stale AI
refs, fix the override count) so the spec is implementable, then implement as a
single reviewed landing commit.

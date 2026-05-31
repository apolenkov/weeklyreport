## Context

Biome landed in `4d7ad5e7` with `recommended: false` and four hand-picked rules.
Enabling `recommended: true` today surfaces **550** findings (measured via
`biome check . --reporter=json`). Breakdown by group: complexity 242
(217 = `useLiteralKeys`, autofixable), style 138 (77 `useImportType`,
58 `useTemplate`, autofixable), a11y 114, suspicious 30, correctness 23
(14 = `useExhaustiveDependencies`), security 2, performance 1.

Empirical autofix reach (`biome check --write --unsafe` on a throwaway tree):
550 → 121 remaining. a11y: 114 → 94 remaining. So the manual surface is
dominated by a11y: ~94 findings need human markup/content
(`noSvgWithoutTitle` 34, `useAriaPropsSupportedByRole` 29,
`noStaticElementInteractions` 13, `useKeyWithClickEvents` 11). Disabling the two
hook rules removes 15 (`useExhaustiveDependencies` 14 + `useHookAtTopLevel` 1),
so the real landing is **~535** findings.

This design records decisions reached in a grilling session; the actual flip and
fixes are deferred to execution.

## Goals / Non-Goals

**Goals:**

- Turn the implied "ratchet up later" into an explicit, recorded standard.
- Flip `recommended: true` with the gate green at the end of one landing commit.
- Record the durable tool-ownership boundary (Biome / ESLint / `tsc`).

**Non-Goals:**

- Removing ESLint or replacing `tsc`.
- Refactoring the 65 cognitive-complexity functions (separate architecture
  change B).
- Executing the flip + fixes in this change (this is the plan artifact only).

## Decisions

**D1 — Big-bang `recommended: true`, one landing commit.**
Alternatives: (a) progressive by autofixability, (b) progressive by Biome group.
Chosen: big-bang, one commit. Rationale: this mirrors how Biome itself landed
(`4d7ad5e7`, a single whole-repo reformat), keeps the config clean
(`recommended: true` beats a hand-maintained rule allowlist for hygiene), and is
the maintainer's explicit call. Trade-off accepted: a large diff (~535 fixes) in
one commit.

**D2 — `recommended: true` in config, not a curated allowlist.**
A hand-maintained per-group allowlist is worse config hygiene and drifts from
upstream. `recommended: true` plus a few explicit overrides is the standard
Biome shape.

**D3 — React hook rules single-owned by ESLint; disable Biome's two.**
Biome `useExhaustiveDependencies`/`useHookAtTopLevel` overlap ESLint
`react-hooks/*`. Since ESLint must run anyway for the three rules Biome cannot
do (D5), there is no value in moving hooks to Biome — only double-reporting risk.
Decision: disable both Biome rules; ESLint stays the single owner.

**D4 — a11y fixed now (error); cognitive complexity deferred (warn).**
Both are large, judgment-heavy, non-autofixable buckets, which is an apparent
asymmetry. It is justified by _nature_: a11y is a **correctness defect**
(accessibility is observable behavior) with element-bounded fixes → fix in this
change at `error`. Cognitive complexity is **open-ended refactoring** that
overlaps the architecture pass → `warn` target here, fixed and escalated to
`error` in change B. a11y strings are authored in English per the repo UI-string
rule.

**D5 — ESLint is not removable.** It owns `react-compiler` (no Biome rule), the
type-aware `no-floating-promises` (Biome's own inference engine is young; the
repo keeps the `tsc`-grade guarantee), `react-hooks`, and the AI logger-secrets
`no-restricted-syntax` selector (Biome's `noRestrictedImports` only matches
import sources, per upstream source — no arbitrary-AST equivalent). `tsc` is a
separate gate Biome never owned; the premise "Biome replaces type-checks" is
incorrect.

**D6 — cognitive-complexity threshold 15 (Biome default).** At 15, 65 functions
are surfaced (20→38, 25→22, 30→11). 15 is the honest full-debt view; because the
rule is `warn`, the count gates nothing. Change B may ratchet the threshold
down (30→…→15) as functions are refactored.

## Risks / Trade-offs

- **Large single-commit diff (~535 fixes)** → mitigate by separating the autofix
  bulk from the ~94 a11y hand-fixes in the commit body / review notes, and using
  safe `biome check --write` first, applying `--unsafe` fixes only after
  per-fix review (unsafe fixes can alter semantics).
- **a11y hand-fixes need human-authored content** (SVG titles, aria roles) →
  authored in English; where a fix needs a real UX decision it is flagged in
  review rather than guessed silently.
- **Hook-rule disable could be forgotten** → encoded as a testable requirement
  in `lint-toolchain-ownership` (reported once, not twice).
- **Load-bearing invariants**: none are touched. (The former
  **ai-module-facade** invariant and its `noRestrictedImports` override were
  removed with the AI module on `chore/remove-ai-module-ui-coming-soon`, which
  this change postdates, so there is no AI-isolation rule left to preserve.) It
  touches no Prisma writes, no period dual-state, no role-coverage gate, no
  destructive-db guard, and no request paths — lint/format only.

## Migration Plan

1. (Execution session) `biome.json`: `recommended: true`; disable
   `useExhaustiveDependencies` + `useHookAtTopLevel`; add
   `noExcessiveCognitiveComplexity: warn` (maxAllowedComplexity 15).
2. `biome check --write` (safe), then review-then-apply `--unsafe` selectively.
3. Hand-fix the ~94 a11y findings at `error` (English strings).
4. Update the `eslint.config.ts` header comment to reference this spec.
5. Verify `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.
   Rollback: revert the single landing commit (config + fixes are atomic).

## Open Questions

- Exact safe-only autofix count (measured here with `--unsafe`); determined at
  execution when the safe `--write` runs.
- Whether change B ratchets the cognitive threshold or fixes-to-zero at 15 —
  decided when change B is scoped.

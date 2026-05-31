# Ratchet the Codebase to the Max-Strictness Standard (Phase 3)

## Why

`declare-lint-max-strictness` (Phase 2) pins the durable max-strictness target as
a spec, with every ramp rule kept `off` in `eslint.config.ts`. This change is
Phase 3: it **drives the codebase to satisfy that standard**, flipping each rule
from `off` to `error` one at a time and fixing the firings, until `pnpm lint` is
green at full strictness.

This is the expensive, judgment-heavy half. **MEASURED on this repo (2026-05-31):**
`strictTypeChecked + stylisticTypeChecked` alone = ~2211 violations / 361 files
(~1010 autofixable, ~1200 manual), before sonarjs/unicorn/max-lines/JSDoc. Top
manual: `require-await` 368, `no-confusing-void-expression` 272,
`no-unnecessary-condition` 223, `restrict-template-expressions` 177, `no-unsafe-*` 209. A one-pass enable-everything is the exact unreviewable big-bang the phasing
exists to avoid.

## What Changes

A sequence of small, attributable commits/PRs that ratchet severity up:

- **Autofix first, isolated.** One mechanical `eslint --fix` commit for the
  autofixable cluster (~1010 firings: `array-type`, `consistent-type-*`,
  `dot-notation`, type-assertion style, import-sort) — no logic change, reviewed
  as a pure mechanical diff.
- **Then one rule at a time, by ascending risk.** Each ramp rule goes `off` →
  `error` with its fixup wave, lands green, then the next. Behavior-risky rules
  (`no-unsafe-*`, `no-unnecessary-condition`) go **last** and get Opus review.
- **Escalation ladder per firing:** fix the code first → per-site
  `eslint-disable` ONLY with a real false-positive reason → raise the threshold or
  add to the documented exclude-list as a last resort, recorded in the standard's
  spec.
- **PR granularity:** a few related rules (2–4) per PR. This composes with
  one-rule-at-a-time fixing: fix per rule internally, bundle related rules into
  one reviewable PR.
- **Gate per cluster:** `pnpm lint` + `pnpm typecheck` + `pnpm test` must pass for
  each cluster before merge.

## Execution model (economy)

- **Model split:** Haiku for mechanical autofix; Sonnet for judgment rules; Opus
  for review of behavior-risky clusters. Matches the "Mind model cost" rule in
  the global operating baseline.
- **Workflow (built at execution time, NOT in the planning session):** per-file
  fan-out, `isolation: "worktree"` for parallel edits, a per-cluster gate, Opus
  review on risky rules. The Workflow is gated on this plan; it is not authored
  while the plan is still being written.
- **Budget:** per-cluster, **no global ceiling**. Each Workflow run = one rule +
  a token target, land green, decide the next. No invented total.

## Impact

- **Sequenced after** `declare-lint-max-strictness` (Phase 2). Enforces, and
  ADDs the execution discipline for, the `lint-max-strictness-standard`
  capability.
- **Touches a large fraction of the codebase** (361 files), but in small isolated
  clusters — each independently revertible.
- **a11y stays untouched:** the inherited a11y carve-outs (documented exclusions
  from Phase 2) are not ramped here; `verify-a11y-recommended-flip` owns a11y.
- Risk: medium-to-high per behavior-risky rule, mitigated by ordering them last,
  Opus review, and the per-cluster gate. The autofix and safe-rule clusters are
  low risk.

## Acceptance

- `openspec validate ratchet-lint-to-strict --strict` is green.
- The ratchet discipline (autofix-first ordering, escalation ladder, per-cluster
  gate, cost-tiered model split, per-cluster budget) is each a requirement with
  ≥1 scenario.
- (At execution, per cluster) `pnpm lint` + `typecheck` + `test` green; no
  mass-disable used to force green; every per-site disable carries a reason.

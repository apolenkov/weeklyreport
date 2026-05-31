# Tasks — Phase 3: Ratchet the Codebase to Max-Strictness

Expensive, judgment-heavy. Each cluster commits/PRs separately and lands the gate
green before the next. **No mass-disable to force green.** Implementation is
deferred — these tasks are the execution plan, not work to start now.

Model split: Haiku (autofix) · Sonnet (judgment rules) · Opus (risky-cluster
review). Budget per cluster; no global ceiling.

## 0. Preconditions

- [ ] R0a `declare-lint-max-strictness` (Phase 2) is landed: the standard spec
      exists and `eslint.config.ts` carries the Phase-3 target scaffold.
- [ ] R0b Re-measure violations against the current tree (the 2026-05-31 numbers
      are a baseline, not a contract). Produce the per-rule firing counts.

## 1. Autofix cluster (Haiku) — one isolated commit

- [ ] R1a Enable the autofixable rules, run `eslint --fix`, commit the mechanical
      diff alone (no logic change). Gate: `pnpm lint` + `typecheck` + `test`.

## 2. Manual clusters, ascending risk (Sonnet; Opus review on risky)

- [ ] R2a Order the remaining rules cheapest/safest → riskiest; schedule
      `no-unsafe-*` and `no-unnecessary-condition` last.
- [ ] R2b For each rule: `off` → `error`, fixup wave via the escalation ladder
      (fix code → per-site disable w/ reason → threshold/exclude as last resort),
      land green, then next. Bundle 2–4 related rules per PR.
- [ ] R2c Behavior-risky clusters get an Opus-level review before merge.

## 3. Plugin-surface clusters

- [ ] R3a sonarjs (incl. `cognitive-complexity` ≤ 15), unicorn (pruned off-list),
      `simple-import-sort`, `max-lines` 300 / complexity ≤ 10 — each its own
      cluster with exempt dirs applied.
- [ ] R3b JSDoc on `packages/shared` + `packages/ui` public exports only.
- [ ] R3c Import boundaries, incl. the `apps/web`→`apps/api` `allowTypeImports`
      carve-out.

## 4. Execution Workflow (authored at execution time, NOT now)

- [ ] R4a Build the Workflow: per-file fan-out, `isolation: "worktree"`,
      per-cluster gate, model split, Opus review on risky rules. Per-cluster
      budget.

## 5. Close-out

- [ ] R5a `pnpm lint` green at full declared strictness; the documented
      exclude-list holds exactly the justified entries (incl. inherited a11y
      carve-outs).
- [ ] R5b `openspec validate ratchet-lint-to-strict --strict` green.

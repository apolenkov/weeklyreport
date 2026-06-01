# Tasks — Phase 3: Ratchet the Codebase to Max-Strictness

Expensive, judgment-heavy. Each cluster commits/PRs separately and lands the gate
green before the next. **No mass-disable to force green.** Implementation is
deferred — these tasks are the execution plan, not work to start now.

Model split: Haiku (autofix) · Sonnet (judgment rules) · Opus (risky-cluster
review). Budget per cluster; no global ceiling.

## 0. Preconditions

- [x] R0a `declare-lint-max-strictness` (Phase 2) is landed: the standard spec
      exists and `eslint.config.ts` carries the Phase-3 target scaffold.
      → archived 2026-06-01; capability in openspec/specs/; scaffold comment in
      eslint.config.ts.
- [x] R0b Re-measure violations against the current tree (the 2026-05-31 numbers
      are a baseline, not a contract). Produce the per-rule firing counts.
      → MEASURED 2026-06-01 (strictTypeChecked + stylisticTypeChecked base only;
      plugin surface not yet installed): **2281 firings / 363 files; 1028
      ESLint-fixable**. Top: require-await 369, consistent-type-definitions 294,
      no-confusing-void-expression 274, no-unnecessary-condition 223,
      restrict-template-expressions 192, dot-notation 184,
      no-unnecessary-type-assertion 131, array-type 119, no-unsafe-\* 242 total.
      R1a SAFE autofix cluster (excludes no-confusing-void-expression — its fix
      rewrites arrow bodies, treat as manual): consistent-type-definitions,
      dot-notation, no-unnecessary-type-assertion, array-type, prefer-optional-chain,
      non-nullable-type-assertion-style, prefer-regexp-exec,
      consistent-generic-constructors, no-unnecessary-type-arguments,
      consistent-indexed-object-style, no-unnecessary-template-expression,
      no-unnecessary-boolean-literal-compare, no-inferrable-types (~768 fixes).

## 1. Autofix cluster (Haiku) — one isolated commit

- [x] R1a Enable the autofixable rules, run `eslint --fix`, commit the mechanical
      diff alone (no logic change). Gate: `pnpm lint` + `typecheck` + `test`.
      → DONE 2026-06-01. Landed the 10 purely-syntactic/proven-noop rules as
      `error` (dot-notation, consistent-type-definitions, array-type,
      prefer-regexp-exec, consistent-generic-constructors, no-unnecessary-type-arguments,
      consistent-indexed-object-style, no-unnecessary-template-expression,
      no-unnecessary-boolean-literal-compare, no-inferrable-types). 234 files,
      ~939/942 lines, all mechanical. Gate green: lint 0 errors, typecheck 5/5,
      test 579 passed.
      One escalation-ladder per-site disable: `VerifiedSamlProfile` kept as a
      `type` alias (interface loses the index signature `Record<string,unknown>`
      needs at saml.strategy.ts:153).
      DEFERRED out of R1a to a later REVIEWED cluster (ESLint-fixable but NOT
      behavior-safe / breaks `tsc` under the lint program): no-confusing-void-expression,
      prefer-optional-chain (runtime-behavior change); no-unnecessary-type-assertion (131),
      non-nullable-type-assertion-style (5) — removing assertions the app tsconfig
      still needs (e.g. `as HTMLInputElement` in RTL tests, `as CompiledHistoryResult`).

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

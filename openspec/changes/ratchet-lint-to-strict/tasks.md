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

- [x] R2a Order the remaining rules cheapest/safest → riskiest; schedule
      `no-unsafe-*` and `no-unnecessary-condition` last.
      → ORDERED 2026-06-01 from a fresh measure (1641 firings / 287 files after
      R1a; exempt-dirs apply only to size/complexity/JSDoc, NOT the type-aware
      base — so base counts are repo-wide). Ascending-risk schedule:
      (1) DONE R2b-1 below; (2) `no-empty-function` (17), `no-extraneous-class`
      (27), `no-misused-promises` (4), `no-deprecated` (28); (3) `require-await`
      (369 — mostly tests + Nest-lifecycle contracts → per-site disable, the
      first Workflow fan-out cluster); (4) `restrict-template-expressions` (202)
      — 184/202 are `${number}`, so this is an `allowNumber` OPTION decision,
      not a per-site fanout; (5) `prefer-nullish-coalescing` (23),
      `unbound-method` (23), `no-base-to-string` (7); (6) LAST, Opus-reviewed:
      `no-confusing-void-expression` (274), `no-unnecessary-condition` (223),
      `no-unsafe-*` (242 total). The deferred R1a assertion rules
      (`no-unnecessary-type-assertion` 131, `non-nullable-type-assertion-style` 5)
      slot into wave 5/6 (they break `tsc` — manual review each).
- [ ] R2b For each rule: `off` → `error`, fixup wave via the escalation ladder
      (fix code → per-site disable w/ reason → threshold/exclude as last resort),
      land green, then next. Bundle 2–4 related rules per PR.
  - [x] R2b-1 SAFE low-risk first cluster (4 rules, NO Workflow — too small to
        justify fan-out): `react/jsx-no-useless-fragment` (warn→error, 8 sites),
        `@typescript-eslint/no-unnecessary-type-conversion` (7),
        `use-unknown-in-catch-callback-variable` (4), `return-await` (1, a real
        correctness gain — await inside try so the catch observes rejections).
        20 errors fixed by hand across 13 files (the rules' autofixers were
        no-ops here). 0 per-site disables needed. Gate green: lint 0 errors,
        typecheck 5/5, test 579 passed.
  - [x] R2b-2 wave-3 `require-await` → error, repo-wide (the declared standard
        does NOT exempt tests for the type-aware base). Fresh measure: 369
        firings / 69 files, of which only 10 in src / 7 files; 359 in 62 test
        files. The split (mostly test mocks) was surfaced to the user before any
        churn — user chose the full repo-wide run over a test-scope carve-out.
        • 10 src sites fixed BY HAND in code, ZERO disables (fix-don't-suppress):
        `Promise.resolve(...)` where the contract strictly returns a Promise
        (period x3, publication x1 hook defaults; mock-telegram `send`;
        next.config `rewrites`), and `async`-dropped + `: void` where the
        contract accepts void (telemetry gauges x2; Nest `onModuleInit` /
        `beforeApplicationShutdown`).
        • 359 test sites done by the FIRST per-file Workflow fan-out (14 Sonnet
        agents, no worktree, plain parallel; advisor guardrails: drop-async
        ONLY on bare test-runner callbacks, else per-site disable w/ contract
        reason, bottom-to-top edit order, no `--fix`, no blanket disable, gate
        AFTER the barrier). Result: 3 drop-async + 356 per-site disables, all
        with `-- mock implements the async … contract` reasons.
        Gate green: require-await 0 repo-wide, lint 0 errors / 13 pre-existing
        warns, typecheck 5/5, test 579 passed. No out-of-scope file edits.
  - [x] R2b-3 wave-2 cluster (4 rules) via overnight Workflow `ratchet-wave2-overnight`
        (one cluster/commit, gate-green-or-scoped-revert, NO push; order
        ascending-risk: empty-function → extraneous-class → deprecated →
        misused-promises). Result: all 4 landed (empty-function + deprecated via the
        overnight Workflow; extraneous-class + misused-promises via SUPERVISED redo):
        • [x] `no-empty-function` (17) → error — committed `3c647c38`, gate green.
        Comment-in-body fix (ESLint treats commented bodies as non-empty), no
        disables.
        • [x] `no-deprecated` (27) → error — committed `019afdc7` (gate green
        AFTER a supervised fix, see below). Internal `stageName` "kept for
        legacy" reads → per-site disable; Terminus health classes → file-level
        single-rule disable + `TODO(ratchet-no-deprecated)` (structural
        migration to HealthIndicatorService deferred to supervised).
        • [x] `no-extraneous-class` (27) → error — SUPERVISED redo landed (2026-06-02,
        no Workflow). 21 of 27 sites are decorated NestJS `@Module` classes →
        resolved cleanly with the rule's built-in `{ allowWithDecorator: true }`
        option (empty `@Module` is correct by design; this is rung-1 config, not a
        weakening — see the new spec scenario), ZERO per-site disables on src. The
        remaining 6 sites are inert `@nestjs/common` lifecycle stubs
        (`OnModuleInit`/`OnModuleDestroy` as `class {}`) inside `vi.mock` factories
        in 3 test files (`email-reminder.processor.test.ts`,
        `pdf-export.processor.test.ts`, `email-dispatch.integration.test.ts`) →
        per-site `eslint-disable-next-line` with reason (single-line property sites,
        so finding (a) prettier-hoisting does not apply). The earlier overnight
        fan-out failure was an agent extracting a named class out of the hoisted
        `vi.mock` factory (`ReferenceError: … before initialization`); the in-place
        disable adds no references and is hoisting-safe. Gate green: no-extraneous-class
        0 repo-wide, lint 0 errors, typecheck 5/5, build pass.
        • [x] `no-misused-promises` (4) → error — SUPERVISED landed (2026-06-02, no
        Workflow). All 4 firings are Promise-in-void-slot, fire-and-forget by intent,
        so each fixed with the void-slot pattern, ZERO disables (the riskiest cluster
        forbids the disable escape). API DLQ listener (`events.on("failed", …)`):
        wrapped the async body in `void (async () => { … })()` — its only awaits are
        already inside try/catch, so the IIFE never rejects, and the arrow preserves
        `this`. Three web void slots rewritten to the file's own `void fetch(…)`
        idiom: nav-bar logout → `void fetch("/auth/logout", …).finally(redirect)`
        (`.finally` keeps the redirect on resolve AND reject, ≡ the prior
        try/await/finally); action-log copy → `void copyToClipboard(value).then(ok …)`
        (copyToClipboard never rejects — full internal try/catch); role-switcher
        logout → `onSelect={() => { void logout(); }}` (matches the sync `reseed`
        sibling). Two adversarial Sonnet reviewers (async-semantics + cross-file/tests)
        returned 0 findings; no test depends on the old handler shape. Gate green:
        no-misused-promises 0 repo-wide, lint 0 errors, typecheck 5/5, test 579,
        build 5/5. Not pushed (morning human review).
        TWO METHODOLOGY FINDINGS from this run (RESOLVED 2026-06-02 into the R4a
        gate-design rules below — the durable home; kept here for the incident record):
        (a) prettier-vs-disable: `eslint-disable-next-line` / `eslint-disable-line`
        CANNOT sit on a multi-line `extends X` heritage clause — pre-commit
        `prettier --write` runs AFTER the gate's lint and hoists the comment above
        `export class`, so the committed tree fails lint though the gated tree
        passed. This is exactly how `019afdc7` landed red on `redis.health.ts:11`
        and needed the supervised fix (→ file-level single-rule disable, which is
        position-independent). The gate must re-lint AFTER staging/prettier, or
        fixers must avoid line-positioned disables on heritage clauses.
        (b) cross-cluster coupling: a cluster's gate runs repo-wide `pnpm lint`, so
        a latent error from an EARLIER cluster reverts the CURRENT one and blames
        it (misused-promises died for no-deprecated's sin). Gate should diff
        firings vs the cluster's own files, not fail on pre-existing repo errors.
  - [x] R2b-4 wave-4 `restrict-template-expressions` → error — SUPERVISED landed
        (2026-06-02, NO Workflow). strictTypeChecked sets every `allow:false` (202
        firings), but **184 are a plain `${number}`** and ~4 `${boolean}` — both safe,
        idiomatic interpolation. OPTION decision surfaced to the user (option vs ~190
        mechanical `String()` wraps); user chose **`allowNumber: true` + `allowBoolean:
true`** (rest stay false), documented inline in eslint.config.ts + the spec's
        "built-in option is a config choice, not a weakening" scenario (same precedent
        as `allowWithDecorator`). That collapsed 202 → 10 genuinely-risky firings,
        fixed BY HAND at the source, ZERO disables:
        • `prisma/_destructive-guard.ts` (4× `any`) → root cause was `process.env.
DATABASE_URL` resolving as `any` in the prisma program; ONE altitude fix
        `const url: string = …` narrowed it and cleared all 4 (not 4 `String()`
        band-aids). NOTE: under wave-6 `no-unsafe-assignment` this `any→string`
        assignment will itself fire — expected, handle it then.
        • `current-week-section.tsx` / `next-week-section.tsx` (`${defaultProduct?.name}`,
        `string | undefined`) → switched the gating ternary from `hasProducts` to
        `defaultProduct` (TS narrows the latter; `hasProducts` truthy ⟺ defaultProduct
        defined, so behavior-identical), making `.name` a plain string. Also aligned
        `disabled` from `!hasProducts` to `!defaultProduct` (onClick was already keyed
        on `defaultProduct`) so disabled/title/onClick stay coherent if malformed API
        data ever breaks the ⟺ — flagged by the adversarial web review.
        • `product-kpi-card.tsx` (`${value}` Recharts `ValueType | undefined`) →
        `${String(value)}` matching the sibling `labelFormatter`'s established idiom.
        • `prisma/reset-hard.ts` (3: `${process.env.REDIS_PORT}` string|undefined,
        `${migrate.status}` / `${seed.status}` number|null) → nullish fallbacks
        (`?? "unset"` / `?? "unknown"`); these are latent-bug fixes (the bare template
        would print literal `"undefined"`/`"null"`), the fallback never triggers on the
        reachable path but is honest if it does.
        Gate green: restrict-template-expressions 0 repo-wide, lint 0 errors, typecheck
        5/5, test 579, build 5/5. Not pushed (morning human review). NOTE on Workflow:
        the user asked for a fan-out, but once the 4 destructive-guard `any` collapsed
        to one root-cause fix the cluster was 1 type-fix + 6 trivial judgment sites —
        below the fan-out threshold, so done inline (advise-on-workflow-usage). The real
        fan-out target is wave 6 (`no-unsafe-*`, ~242).
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
      GATE-DESIGN RULES (from the R2b-3 overnight run's two methodology findings —
      MUST hold before the next fan-out reuses the gate script):
      (a) post-prettier re-lint: the per-cluster gate MUST run `pnpm lint` (or an
      equivalent eslint count) AFTER `git add` + the pre-commit `prettier --write`
      has reformatted the staged tree, not before — because prettier runs in the
      husky hook AFTER the gate's own lint and can hoist a line-positioned
      `eslint-disable` off a multi-line `extends`/`implements` heritage clause,
      leaving the COMMITTED tree red though the gated tree was green. Equivalently,
      fixers MUST NOT place line-positioned disables on multi-line heritage
      clauses — use a file-level single-rule `/* eslint-disable <rule> -- … */`
      there (position-independent). This bit `019afdc7`/`redis.health.ts` and
      required a supervised fix.
      (b) baseline-relative gate: the gate runs repo-wide `pnpm lint`, so a latent
      error left by an EARLIER cluster reverts the CURRENT innocent one and blames
      it (misused-promises died for no-deprecated's red commit). The gate MUST
      capture the repo-wide lint baseline at cluster start; if the baseline is
      already non-empty (a prior cluster left the repo red), ABORT/flag rather than
      silently scoped-reverting this cluster. A cluster passes on: its target rule
      at 0 firings AND no NEW errors beyond the start-of-cluster baseline — it is
      never failed for a pre-existing error it did not introduce. (With (a) fixed,
      clusters land genuinely green, so (b) is mainly a safety net.)

## 5. Close-out

- [ ] R5a `pnpm lint` green at full declared strictness; the documented
      exclude-list holds exactly the justified entries (incl. inherited a11y
      carve-outs).
- [ ] R5b `openspec validate ratchet-lint-to-strict --strict` green.

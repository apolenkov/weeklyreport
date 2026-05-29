# Design — Migrate lint + format to Biome

## Context

The repo's code-quality toolchain today:

- **ESLint 10.2** with `typescript-eslint` strict preset (`eslint.config.ts`):
  `no-explicit-any` (error), `no-floating-promises` (error), `no-unused-vars`
  (error), `no-non-null-assertion` (warn), `react-hooks/rules-of-hooks` (error),
  `react-hooks/exhaustive-deps` (warn), `react-compiler/react-compiler` (error),
  and two AI-module isolation rules (`no-restricted-imports` banning
  `@prisma/client` outside the facade; `no-restricted-syntax` banning
  `logger.*` calls that reference `prompt`/`messages`/`response`).
- **Prettier** referenced only in `lint-staged` — but it is NOT a declared
  devDependency and no binary is installed, so that step is a no-op today.
- **markdownlint-cli2 0.22** for Markdown (`lint:md` over `.planning/**` and
  `README.md`; `.markdownlint.json`).
- Lint wired through four package `lint` scripts (`tsc --noEmit && eslint .`),
  `lint-staged`, `.husky/pre-commit`, and CI (`quality` + `lint-md` jobs).

Wave 3 will run code-quality agents that touch most files. A formatter change
that reformats the whole tree must not collide with those diffs.

## Decision

Adopt **Biome as the primary lint + format tool for the code surface**
(TS/JS/JSX/TSX, JSON/JSONC, CSS), and land it **first** on the Wave-3
integration branch as a single mechanical reformat commit. Keep a **minimal
residual ESLint config**, **markdownlint-cli2** for Markdown, and a **residual
YAML formatter**.

This is a deliberate **hybrid** end state, chosen over "Biome alone" because the
Biome-maturity finding shows four capabilities have no clean Biome home:

1. **`react-compiler/react-compiler`** — no Biome equivalent (open issues
   #2881/#5290). Hard blocker; dropping it silently loses React 19 Compiler
   correctness checks. → stays in ESLint.
2. **AI `no-restricted-syntax` logger-secrets rule** — no built-in Biome rule;
   would need a non-trivial GritQL plugin. Dropping it silently removes the
   `ai-module-facade` / PITFALLS C-3 secret-logging guard. → stays in ESLint.
3. **Markdown lint/format** — Biome has none ("in progress", no resources). →
   markdownlint-cli2 stays unchanged.
4. **YAML format** — Biome "in progress". → residual formatter stays for
   `*.{yml,yaml}`.

What DOES move to Biome: all code formatting (replacing Prettier-for-code),
JSON formatting, the strict-preset lint rules with stable Biome equivalents, and
the AI `no-restricted-imports` Prisma-isolation rule (ports cleanly to Biome
`noRestrictedImports`).

`no-floating-promises` deliberately STAYS in the residual ESLint config rather
than moving to Biome: Biome's `noFloatingPromises` is nursery/experimental,
requires the `types` domain + whole-project Scanner (perf cost), and defaults to
`information` severity. Keeping it in type-aware ESLint preserves the existing
hard-error guarantee with no behavior change.

`react-hooks` rules also stay in ESLint: ESLint must run anyway for the two
hard residuals, and Biome's hook-rule parity is not guaranteed — keeping them in
ESLint avoids a subtle exhaustive-deps regression.

### Ordering rationale

`biome check --write` rewrites whitespace/quotes/import-order across ~every
file. If this lands after other Wave-3 work, every other branch must rebase
through the reformat and the real diffs are buried. Therefore: ONE reformat
commit, FIRST on the integration branch. This is recorded as a locked task
constraint, not just guidance.

## Alternatives considered

### A. Keep ESLint + Prettier (status quo)

Pros: zero migration risk; the toolchain is modern and strict. Cons: Prettier is
already broken (undeclared, no-op in lint-staged); two tools + per-package
scripts to maintain; misses the unification and speed win; and Wave-3 would
still eventually want Biome, deferring the unavoidable repo-wide reformat to a
worse time. Rejected: the grill session locked Biome-first, and the status quo
leaves a broken formatter in place.

### B. Biome alone (remove ESLint and markdownlint entirely)

Pros: one tool, simplest mental model. Cons: silently drops `react-compiler`
(React 19 correctness), the AI logger-secrets guard (a locked `ai-module-facade`
invariant / security control), Markdown lint, and YAML formatting. Rejected: the
maturity finding shows these four have no stable Biome home; "one tool" would be
a regression on locked invariants.

### C. Hybrid — Biome for code + minimal ESLint + markdownlint + YAML formatter

(CHOSEN)

Pros: captures ~90% of the unification/speed win; preserves every current
guarantee (react-compiler, react-hooks, AI isolation imports AND logger-secrets,
no-floating-promises, Markdown lint, YAML format). Cons: still three+ tools, so
"one tool" marketing doesn't hold; ESLint config shrinks to ~3-4 rules but
doesn't disappear. Accepted: it is the only option that adopts Biome WITHOUT
losing a locked invariant.

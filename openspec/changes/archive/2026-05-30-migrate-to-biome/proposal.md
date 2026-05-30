# Migrate lint + format from ESLint + Prettier to Biome

## Why

Wave 3 (code-quality) runs a fleet of simplifier/modernization/expert agents
that will touch nearly every file. If those land on the current ESLint +
Prettier toolchain and Biome arrives afterwards, the Biome adoption — which
reformats the ENTIRE tree — produces a second repo-wide diff that buries the
real Wave-3 changes and forces every other branch to rebase through a
whitespace storm.

The grill session 2026-05-29 locked the order: **Biome lands FIRST on the
Wave-3 integration branch, before any other Wave-3 work.** This change is that
foundation. Doing it first means exactly one reformat-everything commit; all
later Wave-3 diffs are then reviewable.

The current toolchain is also frayed at the edges:

- Prettier is referenced only inside `lint-staged` (`*.{json,yml,yaml}` and the
  `*.md` step) but is **not a declared devDependency** and no `prettier` binary
  is installed — that pre-commit formatting step is effectively a no-op today.
- Lint is split across four package `lint` scripts (`tsc --noEmit && eslint .`),
  a root `eslint.config.ts`, `lint-staged`, husky, and CI.

Biome unifies lint + format for the code surface (TS/JS/JSX/TSX, JSON/JSONC,
CSS) into one fast tool with one config.

## What Changes

Per the Biome-maturity finding, this is a ~90% replacement, **not** "Biome
alone". The end state is \*\*Biome + a minimal residual ESLint + markdownlint-cli2

- a residual YAML formatter\*\*:

- **Add `biome.json`** at the repo root owning lint + format for
  `**/*.{ts,tsx,js,jsx,mjs,json,jsonc,css}`. Seed it via
  `biome migrate eslint --write` and `biome migrate prettier --write`, then
  hand-review rule parity (the migration is NOT 1:1).
- **Reformat the entire tree** with `biome format --write` / `biome check
--write`. This is the one intentional repo-wide diff; it lands as its own
  commit, first, ahead of all other Wave-3 work.
- **Port the AI module isolation `no-restricted-imports`** (Prisma-outside-facade
  ban) to Biome `noRestrictedImports`, scoped to `apps/api/src/modules/ai/**`
  with the same overrides for the facade files and tests.
- **Keep a minimal `eslint.config.ts`** holding only the rules Biome cannot do:
  - `react-compiler/react-compiler` (hard blocker — no Biome equivalent; loses
    React 19 Compiler safety if dropped).
  - The AI `no-restricted-syntax` logger-secrets rule (no built-in Biome rule;
    a GritQL plugin is non-trivial — keep it in ESLint to protect the
    `ai-module-facade` PITFALLS C-3 guard).
  - `react-hooks/rules-of-hooks` + `exhaustive-deps` stay in ESLint too, since
    ESLint must run anyway and Biome's hook-rule parity is not guaranteed.
- **Keep `markdownlint-cli2` unchanged.** Biome has no Markdown lint or format
  (officially "in progress", team-acknowledged no resources). `lint:md` /
  `lint:md:fix` and `.markdownlint.json` are untouched.
- **Keep a residual formatter for YAML** (Biome YAML format is "in progress").
  Biome owns JSON formatting; YAML stays on the existing Prettier-or-equivalent
  step. Markdown formatting stays via `markdownlint-cli2 --fix`.
- **Replace lint/format scripts**: root `lint` becomes Biome + the residual
  ESLint pass + the existing `lint:prisma:typecheck`; add a `format` script;
  per-package `lint` scripts swap `eslint .` for the Biome+ESLint pair while
  keeping `tsc --noEmit` (typecheck is separate).
- **Update `lint-staged`** to run `biome check --write` on code files and the
  residual ESLint pass for the rules Biome lacks; keep the markdownlint step;
  keep/repair the YAML formatter step.
- **Update CI** (`.github/workflows/ci.yml`): the `quality` job runs Biome; the
  `lint-md` job is unchanged.
- **Remove old config** that Biome fully subsumes; **shrink** (not delete)
  `eslint.config.ts` to the residual rules.
- **Update `CLAUDE.md`** command references so `pnpm lint` / format guidance and
  the lint-stack description match Biome.

## Impact

- **Affected files**: `biome.json` (new), `eslint.config.ts` (shrunk),
  root `package.json` (scripts, `lint-staged`, devDependencies), per-package
  `package.json` (`apps/api`, `apps/web`, `packages/shared`, `packages/ui`),
  `.husky/pre-commit`, `.github/workflows/ci.yml`, `CLAUDE.md`.
  `.markdownlint.json`, `lint:md*` scripts, and Prisma `lint:prisma:typecheck`
  are **unchanged**.
- **Blast radius**: the `biome check --write` pass rewrites whitespace/quote/
  import-order across the whole tree. This is behavior-preserving (formatting +
  autofixable lint only) but touches ~every file — hence the FIRST-on-branch
  ordering requirement.
- **Risk**: medium. The dangerous mistakes are silent rule _loss_ during
  migration: dropping `react-compiler`, dropping the AI logger-secrets guard, or
  letting `no-floating-promises` regress. Mitigation: the residual ESLint config
  is mandatory and verified by tasks; the AI-module isolation behavior is proven
  by re-running the existing `ai-module-facade` guard tests after the port.
- **Out of scope**: dependency major bumps (separate Wave-3 work), any
  structural refactor, Markdown lint changes, YAML lint changes, and adopting
  Biome's experimental `types` domain / `noFloatingPromises` nursery rule
  (`no-floating-promises` stays enforced in the residual ESLint config so the
  guarantee is never weakened).

> **Update (2026-05-30, AI backend removal):** the two AI-specific lint rules
> referenced above — the `noRestrictedImports` Prisma-outside-facade ban and the
> `no-restricted-syntax` logger-secrets guard (both scoped to
> `apps/api/src/modules/ai/**`) — were removed together with the AI module on
> branch `chore/remove-ai-module-ui-coming-soon`. Those port/guard-test sub-tasks
> are now void; the `ai-module-facade` durable spec they protected was deleted in
> the same change. The rest of the Biome migration is unaffected.

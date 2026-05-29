# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

> ORDERING (locked, grill 2026-05-29): this change MUST land FIRST on the Wave-3
> integration branch, before any other Wave-3 work. The repo-wide reformat must
> be exactly one diff; no other Wave-3 branch may merge ahead of it.

## Add Biome and seed config

- [ ] Add `@biomejs/biome` as a root devDependency (pin a v2.4+ stable line).
- [ ] Run `pnpm exec biome migrate eslint --write` and
      `pnpm exec biome migrate prettier --write` from the repo root to scaffold
      `biome.json`. Treat the output as a STARTING POINT only.
- [ ] Configure `biome.json` to own lint + format for
      `**/*.{ts,tsx,js,jsx,mjs,json,jsonc,css}` and to mirror the current ignore
      set from `eslint.config.ts` (`**/node_modules/**`, `**/dist/**`,
      `**/.next/**`, `**/.next-e2e/**`, `**/coverage/**`, `**/.turbo/**`,
      `**/prisma/generated/**`, `prisma/seed*.ts`, `**/e2e/**`).
- [ ] Hand-review rule parity against `eslint.config.ts`: confirm Biome
      equivalents for the `tseslint.configs.strict` preset, plus
      `no-explicit-any` (error), `no-unused-vars` (error, with `^_` ignore
      patterns), `no-non-null-assertion` (warn). The migration is NOT 1:1.

## Port the AI-module isolation guard (no-restricted-imports)

- [ ] In `biome.json`, add a `noRestrictedImports` override scoped to
      `apps/api/src/modules/ai/**/*.ts` banning `@prisma/client` with the same
      message, and EXCLUDE the facade boundary + tests
      (`ai-facade.ts`, `ai-cache.ts`, `ai-authz.ts`, `__tests__/**`,
      `__fixtures__/**`, `*.test.ts`, `*.spec.ts`, `*.eval.ts`).
- [ ] Re-run the existing `ai-module-facade` guard test(s) to prove the ported
      rule still flags a raw `@prisma/client` import outside the facade.

## Shrink (do NOT delete) eslint.config.ts to the residuals

- [ ] Reduce `eslint.config.ts` to ONLY the rules Biome cannot replace:
      `react-compiler/react-compiler` (error),
      `react-hooks/rules-of-hooks` (error),
      `react-hooks/exhaustive-deps` (warn), and the AI
      `no-restricted-syntax` logger-secrets selector (scoped to
      `apps/api/src/modules/ai/**`, same selector and message). Keep
      `no-floating-promises` (error) here too so the guarantee is never
      weakened. Remove rules now owned by Biome.
- [ ] Drop the now-unused ESLint devDependencies that the residual config no
      longer needs (e.g. `@typescript-eslint/eslint-plugin` if the residual set
      no longer requires the strict preset). Keep `eslint`, `typescript-eslint`
      (for `no-floating-promises` type-aware lint), `eslint-plugin-react-compiler`,
      `eslint-plugin-react-hooks`.

## Reformat the entire tree (the one intentional repo-wide diff)

- [ ] Run `pnpm exec biome check --write` across the repo. Commit this as its
      OWN commit, message making clear it is the mechanical Biome reformat.
- [ ] Verify the diff is formatting + autofixable-lint only (no behavior change):
      spot-check that no logic, strings, or exports changed.

## Replace lint/format scripts

- [ ] Decide the invocation model: Biome runs as a SINGLE root pass against the
      one `biome.json` (Biome's normal mode), NOT fanned out via `turbo` per
      package. The residual ESLint pass also runs once from root. Make root
      script, per-package scripts, and CI all consistent with this single-pass
      model so Biome is never wired to run twice.
- [ ] Root `package.json`: rewrite `lint` to run the single root Biome lint +
      the single residual ESLint pass + the existing `lint:prisma:typecheck`.
      Add a `format` script (`biome format --write`). Leave `lint:md` /
      `lint:md:fix` / `lint:prisma:typecheck` unchanged.
- [ ] Per-package `package.json` (`apps/api`, `apps/web`, `packages/shared`,
      `packages/ui`): KEEP `tsc --noEmit -p tsconfig.json` for typecheck. Drop
      the per-package `eslint .` from the `lint` script (lint now runs once at
      root); reconcile `turbo.json`'s `lint` pipeline so the root Biome+ESLint
      pass is the single source and packages do not each re-run a linter.
- [ ] Update root `lint-staged`: run `biome check --write` on
      `*.{ts,tsx,js,jsx,mjs,json,jsonc,css}` plus the residual ESLint
      `--fix --max-warnings=0` pass for the Biome-lacking rules. KEEP the `*.md`
      markdownlint step. KEEP a working YAML formatter for `*.{yml,yaml}`
      (Biome cannot format YAML); repair the currently-no-op Prettier step or
      replace it with an installed equivalent.

## Update CI and husky

- [ ] `.github/workflows/ci.yml`: in the `quality` job replace the
      `pnpm turbo lint` step with `pnpm lint` (the single-root-pass Biome +
      residual ESLint), keeping the separate `lint:prisma:typecheck` and
      `typecheck` steps. Leave the `lint-md` job (`pnpm lint:md`) unchanged.
- [ ] Confirm `.husky/pre-commit` still drives `lint-staged` (no change needed
      beyond the `lint-staged` config update above).

## Update docs

- [ ] `CLAUDE.md`: update the lint-stack description and any `pnpm lint` /
      format command references so they describe Biome (code) + residual ESLint
      (react-compiler, react-hooks, AI logger-secrets, no-floating-promises) +
      markdownlint-cli2 (Markdown) + residual YAML formatter. State that Biome
      lands first on the Wave-3 integration branch.

## Gates

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green.
- [ ] `pnpm lint:md` green (markdownlint untouched).
- [ ] Pre-commit smoke test: stage a TS file with a format error and a `.yml`
      file; confirm `biome check --write` fixes the TS file and the YAML
      formatter touches the YAML on commit.
- [ ] `openspec validate migrate-to-biome --strict` passes.

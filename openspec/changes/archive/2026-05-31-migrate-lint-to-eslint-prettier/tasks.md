# Tasks — Phase 1: Biome → ESLint + Prettier (+ stylelint), 1:1 port

Behavior-preserving. **No new lint rules.** Each cluster commits separately.
Models: Haiku for mechanical work, Opus for the review gate before each commit.

## 0. Inventory (Opus/Sonnet — grounding, do not skip)

- [x] M0a Catalog the live Biome `recommended` rules that actually fire on this
      repo + the repo overrides, and map each to its ESLint/plugin equivalent
      (the 1:1 table). Flag any Biome rule with NO ESLint equivalent.
- [x] M0b List all 106 `biome-ignore` sites with their rule + reason; produce
      the per-site `biome-ignore → eslint-disable-next-line` mapping. Mark the
      ~13 dialog-backdrop a11y suppressions referenced by
      `verify-a11y-recommended-flip` so its catalog can be re-pointed.
- [x] M0c Confirm the CI step(s) in `.github/workflows/ci.yml` that invoke
      Biome.

## 1. Tooling swap (deps + config) — single commit

- [x] M1a `pnpm rm @biomejs/biome`; `pnpm add -D eslint-plugin-jsx-a11y
eslint-plugin-react eslint-plugin-simple-import-sort
eslint-plugin-unused-imports stylelint stylelint-config-standard`
      (Prettier/ESLint/typescript-eslint already present).
- [x] M1b Extend `eslint.config.ts`: keep the residual rules + projectService;
      add tseslint **recommended** (NOT strict), jsx-a11y, react,
      simple-import-sort, unused-imports; re-add Biome's overrides
      (no-explicit-any: error, no-non-null-assertion: warn, no-unused-vars:
      error). Mirror `biome.json` ignores into `globalIgnores` (already mostly
      there). Add the test-file a11y-off override (mirror Biome's overrides).
- [x] M1c Create `.prettierrc.json` mirroring the Biome formatter block
      (printWidth 80, tabWidth 2, useTabs false, singleQuote false, semi true,
      trailingComma all). Create `.prettierignore` from `biome.json`
      `files.includes` exclusions.
- [x] M1d Create `.stylelintrc.json` (`stylelint-config-standard` + Tailwind
      at-rule/directive allowance) for the 4 CSS files.
- [x] M1e Delete `biome.json`.

## 2. Scripts / hooks / CI — single commit

- [x] M2a `package.json` scripts: `lint` = `eslint . && stylelint "**/*.css"
--allow-empty-input && pnpm lint:prisma:typecheck`; `format` = `prettier
--write .`; add `format:check` = `prettier --check .`. Remove
      `biome format`.
- [x] M2b lint-staged: ts/tsx/js/jsx/mjs → `eslint --fix` then `prettier
--write`; css → `stylelint --fix` then `prettier --write`; json/jsonc →
      `prettier --write`; yml/yaml/md → `prettier --write` (unchanged).
- [x] M2c CI `.github/workflows/ci.yml`: replace Biome step with `pnpm lint` +
      `pnpm format:check`.

## 3. Suppression conversion — single commit (parallelizable across files)

- [x] M3a Apply the M0b mapping: every `biome-ignore lint/<g>/<rule>: <reason>`
      → `eslint-disable-next-line <eslint-rule> -- <reason>`. Drop suppressions
      whose rule has no ESLint equivalent.
- [x] M3b Re-point `verify-a11y-recommended-flip`'s catalog references from
      `biome-ignore` to `eslint-disable` form (coordinate; do not interleave
      with its runtime sweep).

## 4. Prettier reformat — single ISOLATED commit

- [x] M4a `pnpm format` once over the whole tree. Commit alone as `chore:
reformat with prettier`. Expect a large diff (Biome ≠ Prettier output).

## 5. Gate green — verification

- [x] M5a `pnpm lint` → 0 errors (warnings allowed where Biome warned, e.g.
      no-non-null-assertion). **No rule mass-disabled** to force green.
- [x] M5b `pnpm format:check` → clean.
- [x] M5c `pnpm typecheck && pnpm test && pnpm build` → all green
      (behavior-preserving check).
- [x] M5d Opus review of the full assembled diff: correct rule-name mappings,
      no dropped suppressions, no behavior drift, no smuggled new rules.

## 6. Spec + docs

- [x] M6a Write the delta spec in `specs/lint-toolchain-ownership/` superseding
      the Biome-ownership requirements with ESLint/Prettier/stylelint ownership.
- [x] M6b Update `CLAUDE.md` "Lint stack" section to the new reality (only
      after the swap lands green).
- [x] M6c `openspec validate migrate-lint-to-eslint-prettier --strict`.

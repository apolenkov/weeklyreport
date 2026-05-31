## 1. Swap the tooling (package.json)

- [x] 1.1 lint-staged `*.md`: `markdownlint-cli2 --fix` → `prettier --write`
- [x] 1.2 Remove the `lint:md` and `lint:md:fix` scripts
- [x] 1.3 Remove the `markdownlint-cli2` devDependency
- [x] 1.4 Delete `.markdownlint.json`
- [x] 1.5 `pnpm install` to drop `markdownlint-cli2` from the lockfile

## 2. One-time format pass

- [x] 2.1 Run `prettier --write "**/*.md"` (respecting `.gitignore` / ignore
      files); review the normalization diff (`proseWrap: preserve` → no reflow)
- [x] 2.2 Spot-check openspec specs/changes Markdown still parses correctly
      (heading levels and `#### Scenario:` blocks untouched by formatting)

## 3. Docs + CI

- [x] 3.1 Update `CLAUDE.md` lint-stack section: Markdown is formatted by
      Prettier (alongside YAML), not linted; markdownlint removed; note the
      Biome-markdown future-trigger
- [x] 3.2 Remove / update any CI step invoking `lint:md` (search
      `.github/workflows/`)

## 4. Verification

- [x] 4.1 Confirm a `*.md` edit on commit triggers `prettier --write` via
      lint-staged and produces no markdownlint output
- [x] 4.2 `grep -r markdownlint` returns nothing in `package.json`, scripts, and
      CI; no `.markdownlint.json` remains
- [x] 4.3 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` still green
      (none should reference `lint:md`)
- [x] 4.4 Land as a single commit (tooling swap + normalization atomic for clean
      rollback)

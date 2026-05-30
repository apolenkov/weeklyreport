## Why

Markdown in this repo is owned by markdownlint-cli2 — a *linter* that emits
errors (MD022, MD032, …) a contributor must stop and hand-fix, even though
Prettier (already a dependency, already owning YAML) formats Markdown natively
as one of its core languages. The lint friction buys structural checks nobody is
actively relying on; the maintainer wants Markdown to behave like YAML: a
background formatter that silently normalizes on commit, never a gate that
blocks with errors.

## What Changes

- lint-staged `*.md`: `markdownlint-cli2 --fix` → **`prettier --write`** (same
  treatment as `*.{yml,yaml}`).
- Remove the `lint:md` / `lint:md:fix` scripts, the `markdownlint-cli2`
  devDependency, and the `.markdownlint.json` config.
- One-time `prettier --write` pass over all Markdown to normalize formatting
  (Prettier defaults to `proseWrap: "preserve"`, so prose is not re-wrapped —
  the diff is list-marker / spacing / code-fence normalization, not a reflow).
- Update `CLAUDE.md` (which currently says "markdownlint-cli2 owns Markdown") and
  any CI step that invokes `lint:md`.

## Non-goals

- **Removing Prettier.** It stays (and gains Markdown alongside YAML).
- **Markdown content/structure checks.** Dropping the linter intentionally gives
  up markdownlint's structural rules (heading hierarchy, bare URLs, broken link
  fragments). This is accepted: Markdown is a background-formatted artifact, not
  a gated one.
- **Other repositories.** This change covers `customreport` only. The same swap
  in Core Dev / Core Principles / Pulse is out of scope here and must be done
  in those repos.
- **Executing the swap.** This records the plan; the package.json edits, the
  one-time format pass, and the commit are a separate session.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities

- `lint-toolchain-ownership`: adds Markdown to the ownership contract — Markdown
  is *formatted* by Prettier and *not linted*; markdownlint is removed. (This
  capability is introduced by the `enable-biome-recommended-ruleset` change; this
  change contributes an additional ADDED requirement to it.)

## Impact

- `package.json` (lint-staged `*.md` rule, removed scripts + devDependency).
- `.markdownlint.json` deleted.
- One-time formatting diff across all `*.md` (openspec/, docs/, README, etc.).
- `CLAUDE.md` lint-stack section and any CI `lint:md` invocation.
- No runtime, schema, or API impact — formatting/tooling only.

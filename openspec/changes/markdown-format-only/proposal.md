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

## Grill findings — 2026-05-30

Adversarial review of the explorer analysis. Surviving findings:

- **major — dependsOn: `enable-biome-recommended-ruleset` (explorer said `[]`).**
  Two independent grounds. (a) This change's only `ADDED` requirement targets the
  `lint-toolchain-ownership` capability, which does **not** exist in
  `openspec/specs/` — the proposal itself states biome introduces it. (b)
  `enable-biome-recommended-ruleset` task 6.5 verifies `pnpm lint:md` is green,
  and this change deletes that script. Clean order:
  biome → markdown-format-only → dep-upgrades. NB: this is an *ordering* edge, not
  a hard validate failure — `openspec validate markdown-format-only --strict`
  passes today (ADDED-to-a-missing-capability is allowed in isolation); `archive`
  was not tested.
- **major — gatesSufficient is false (explorer said true).** `pnpm typecheck &&
  lint && test && build` do not read Markdown at all; after this change Markdown
  is explicitly *not* gated, so those gates are green-by-construction and prove
  nothing about this change's risk. The real check is `openspec list` +
  `openspec validate --strict` across **all** changes after the one-time format
  pass, plus a human diff review. Task 2.2's one-line "spot-check" under-scopes
  this.
- **minor — blastRadius is medium, not low.** Non-mutating
  `prettier --list-different "**/*.md"` rewrites **38 of 242** Markdown files,
  including `openspec/specs/schema-conventions/spec.md` and many
  `openspec/changes/**/{proposal,tasks,design}.md`. Each edit is mechanical
  (blank-line / list-marker / code-fence normalization, `proseWrap: preserve`),
  but the cross-spec spread warrants a diff-scale review, not bare gates.
- **info — verified: prettier does NOT break openspec parsing.** Dry-run diffs on
  `schema-conventions/spec.md` and a change `spec.md` with `#### Scenario:` /
  `- **WHEN**` blocks show only whitespace normalization; no
  heading/requirement/scenario marker is altered. So the openspec-parse risk is
  real-but-low, provided 2.2 is upgraded to a full `validate --strict` sweep.
- **info — filesTouched: CLAUDE.md edit is wider than stated.** `pnpm lint:md` /
  `lint:md:fix` appears at CLAUDE.md lines 73-76 **and** in the planning-docs code
  block at lines 81-82; both must be updated. The CI `lint-md` job is the whole
  job (ci.yml lines 22-48) and is standalone (no other job `needs:` it), so
  removing the entire job is clean.
- **info — sharedFiles add CLAUDE.md and `.github/workflows/ci.yml`** as
  cross-change edit surfaces; `enable-biome-recommended-ruleset` and
  `migrate-to-biome` both touch the lint-staged/markdown surface. Confirmed
  `currentState=not-started` (markdownlint-cli2 + `.markdownlint.json` +
  `lint:md` scripts + CI job all live).

**Revised recommendation: implement** — but (1) record `enable-biome-recommended-ruleset`
as a hard predecessor, (2) upgrade task 2.2 to an `openspec validate --strict`
sweep across all changes, and (3) treat the format pass as a diff-scale review,
not a bare-gate, change.

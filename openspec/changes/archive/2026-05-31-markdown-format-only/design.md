## Context

Markdown is currently owned by markdownlint-cli2 (a linter) in two places:
`lint:md`/`lint:md:fix` scripts (scoped to `README.md`) and a lint-staged
`*.md` → `markdownlint-cli2 --fix` rule (all `*.md`), configured by
`.markdownlint.json`. Prettier 3.4.2 is already a dependency and already owns
`*.{yml,yaml}` via lint-staged. The maintainer wants Markdown treated like YAML:
silently formatted on commit, never an error gate.

## Goals / Non-Goals

**Goals:**

- Replace the Markdown _linter_ with a Markdown _formatter_ that runs in the
  background and never blocks a commit with errors.
- Add no new tool/dependency to the stack.

**Non-Goals:**

- Keeping markdownlint's structural checks (intentionally dropped).
- Touching other repositories (Core Dev / Core Principles / Pulse).
- Executing the swap (this records the plan only).

## Decisions

**D1 — Prettier, not dprint, not Biome.** Researched May 2026:

- **Biome** (the repo's primary lint/format tool) does **not** have a stable
  Markdown formatter in v2.4 — the `biome_markdown_formatter` crate exists and is
  porting Prettier's test suite, but the formatter is unreleased/experimental and
  the parser is still maturing. So the "one tool" consolidation is not available
  yet.
- **dprint** has a fast Rust Markdown plugin, but it is a new binary + config to
  add and maintain; its speed advantage is irrelevant for doc-sized Markdown.
- **Prettier** already ships in the repo (owns YAML), formats Markdown natively
  as a core language, and adds **zero new dependencies**. It defaults to
  `proseWrap: "preserve"`, so prose is not re-wrapped — the one-time diff is
  list-marker / spacing / code-fence normalization, not a reflow.

Decision: use Prettier. Sources — Biome v2.4 blog, Biome roadmap 2026, Biome
discussion #923, dprint markdown plugin docs, npm-compare biome-vs-dprint.

**D2 — Future-trigger to reconsolidate onto Biome.** When Biome's Markdown
formatter reaches stable release, revisit: move `*.md` (and ideally `*.yaml`)
onto Biome and drop Prettier entirely, collapsing the toolchain to Biome + the
residual ESLint. Recorded so the Prettier choice is understood as pragmatic, not
permanent.

**D3 — Accept loss of structural checks.** markdownlint catches heading
hierarchy, bare URLs, and broken link fragments; Prettier does not. The
maintainer explicitly wants a background formatter, so these checks are dropped
rather than re-homed. If a structural check is ever needed back, it returns as a
separate decision, not by keeping markdownlint alive by default.

## Risks / Trade-offs

- **One-time reflow diff across all `*.md`** (openspec/, docs/, README) → expected
  and wanted ("push everywhere"); `proseWrap: "preserve"` keeps it moderate.
- **Prettier and markdownlint disagree on formatting** → removing markdownlint
  eliminates the conflict entirely (no two-tool tug-of-war on `*.md`).
- **CI / docs drift** → the swap must also update `CLAUDE.md` (states
  "markdownlint-cli2 owns Markdown") and any CI `lint:md` step, or the gate
  references a script that no longer exists.
- **Load-bearing invariants**: none touched — formatting/tooling only, no runtime,
  schema, API, or the five durable invariants.

## Migration Plan

1. (Execution session) `package.json`: lint-staged `*.md` →
   `prettier --write`; remove `lint:md`/`lint:md:fix`; remove the
   `markdownlint-cli2` devDependency.
2. Delete `.markdownlint.json`.
3. One-time `prettier --write "**/*.md"` (respecting ignore files); commit the
   normalization diff.
4. Update `CLAUDE.md` lint-stack section and any CI `lint:md` invocation.
5. `pnpm install` to drop the removed dependency from the lockfile; confirm a
   `*.md` commit triggers `prettier --write` via lint-staged.
   Rollback: revert the single commit (config + normalization are atomic).

## Open Questions

- Whether to add a minimal `.prettierrc` to pin Markdown options (e.g.
  `proseWrap`) or rely on defaults — decided at execution; defaults are likely
  sufficient.

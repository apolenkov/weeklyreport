# Consolidate The Tooling Layer Onto What Already Exists

## Why

The gate layer grew by accretion. Each addition was locally reasonable; together
they hand-roll work that the package manager, the runtime, and ESLint already do
— and the hand-rolled versions are weaker than the originals.

**A text scanner doing an AST job.** `scripts/find-status-literal-unions.mjs` is
161 lines of regular expressions over source text, with 181 lines of tests, that
looks for literal unions re-declaring a vocabulary owned by `packages/shared`.
Its seven `ALLOWLIST` paths are legitimate: three are the SSOT declarations
themselves, and four are mirrors that `status-type-ssot-gate` and `role-type`
document as deliberate, because `prisma/` and `e2e/` have isolated tsconfigs
that cannot resolve `@customreport/shared`. They survive the migration as
`files` overrides, unchanged.

ESLint core `no-restricted-syntax` takes esquery selectors, and esquery supports
`:has()`. Verified on this exact toolchain (ESLint 10, typescript-eslint 8.65):

```
type Bad     = "green" | "yellow" | "red"            → matched
type Fine    = "green" | "blue"                      → not matched
type AlsoBad = "red" | "green" | "yellow" | "grey"   → matched
```

The real declarations are mostly `z.enum([...])`, not TS unions, so the selector
has to cover both; and the report-status vocabulary is specified as a set
_exactly_ equal to `{draft, published}`, where `:has()` alone would wrongly flag
the legal superset `"draft" | "published" | "archived"`. Both are expressible and
both were verified on the installed toolchain:

```
:matches(TSUnionType, CallExpression[callee.object.name="z"][callee.property.name=/^(enum|union)$/])
  :has(Literal[value="draft"]):has(Literal[value="published"])
  :not(:has(Literal:not([value="draft"]):not([value="published"])))
```

**The selectors do not belong in `eslint.config.ts`.** Four separate findings kill
that placement, and each was demonstrated rather than argued:

- `no-restricted-syntax` is _already_ in use repo-wide for the deliberate `let`
  escape hatch, with eight live suppressions. Any rule-ID-level protection of the
  status gate would also freeze those.
- `@eslint-community/eslint-comments/no-restricted-disable` cannot restore the
  no-escape property: disabling _the guard rule itself_ first, then the gate,
  passes clean. Adding the guard to its own restricted list does not help — the
  comment suppresses the rule before it can report.
- `linterOptions.noInlineConfig` _does_ close every escape route, but it is
  per-file and all-or-nothing, and the tree carries **591 inline
  `eslint-disable`s across 140 files**.
- `eslint.config.ts` globally ignores all of `e2e/**` and three Prisma seed
  entrypoints. A later `files` override cannot re-include a globally ignored
  path, and the scanner covers those trees today. Moving to config would silently
  drop them.

So the gate stays a script — but stops being regular expressions. It calls
ESLint's `Linter` API directly with `noInlineConfig: true` and the four
selectors, and walks the tree itself. That keeps AST exactness, keeps absolute
no-escape, keeps `e2e/` and `prisma/` coverage, and leaves the repository's 591
legitimate suppressions untouched — none of which the config placement can do at
once. Roughly 60 lines replace 342.

**A comment scanner that cannot see comments.** `scripts/find-archaeology.mjs`
greps source text for ticket and phase slugs, and needs a 27-entry list of
"this is a standard, not a ticket" (ISO, UTF, SHA, RFC, TLS…) because it cannot
tell `RFC-5322` inside a URL from `UFB-036` in a comment. A rule using
`sourceCode.getAllComments()` is handed comments as comments; the list of
standards disappears with the ambiguity that created it.

**Three declarations of one version.** `@types/node` is written literally into
`package.json`, `apps/web/package.json` and `packages/shared/package.json`, and a
script checks afterwards that they still agree. pnpm's `catalog:` protocol makes
them agree at install time. Thirteen dependencies are declared in more than one
manifest; one has already drifted:

```
recharts   3.8.1     apps/web/package.json     (the only consumer)
recharts   ^3.10.0   packages/ui/package.json  (the wrapper it consumes)
```

A pin against a caret means the chart primitive and its caller can resolve
different copies of a context-bearing library — a class of bug that fails
silently.

**Nothing updates the images.** `.github/dependabot.yml` declares `npm` and
`github-actions`. There is no `docker` ecosystem, so `FROM node:26-bookworm@sha256:…`
in both Dockerfiles is never bumped by anything. This is the mechanism that left
`Dockerfile.web` on Node 25 for eight weeks after its end of life; the 2026-07-25
change fixed the symptom, not the cause.

**`.mjs` outlives its reason.** Twenty `.mjs` files exist because the root
`package.json` has no `"type"` field, so `.js` there is CommonJS. Under that
constraint the extension was the only way to get ESM — and the cost is that
~830 lines of gate-deciding logic in `scripts/` and `e2e/sweep/` are the only
code in the repository that no `tsc` ever reads. Node 26.5 strips types with no
flag (verified), so these can be typed `.ts`. The blast radius of adding
`"type": "module"` to the root manifest is one `.js` file, in
`openspec/changes/archive/`, that nothing executes.

## What Changes

- Root `package.json` gains `"type": "module"`; `scripts/**` and `e2e/sweep/**`
  become `.ts`, covered by a new `tsconfig.scripts.json` with
  `erasableSyntaxOnly` so they cannot drift into syntax the runtime cannot strip.
- `find-status-literal-unions` becomes `no-restricted-syntax` entries;
  `find-archaeology` becomes a local ESLint rule over `getAllComments()`. Both
  scripts and their bespoke test harnesses are deleted; rule behaviour is
  covered by `RuleTester` under vitest.
- `pnpm-workspace.yaml` gains a `catalog:`; the thirteen multiply-declared
  dependencies move into it. `recharts` is unified on one range.
- `.github/dependabot.yml` gains the `docker` ecosystem for both Dockerfiles.
- `scripts/check-runtime-node-sync.mjs` survives as the only script, minus its
  `@types/node` check, which becomes pnpm's guarantee rather than a lint pass.

## What Does Not Change

`postcss.config.mjs`, `commitlint.config.cjs` and `.dependency-cruiser.cjs` keep
their extensions: each is loaded by its own tool's resolver, and changing them
argues with a third-party loader for no gain.

The cross-artifact Node-major assertion stays a script and always will — it
reads `.nvmrc` and two Dockerfiles, which ESLint does not parse. It becomes
_more_ load-bearing once dependabot starts moving base images weekly without
touching `.nvmrc`.

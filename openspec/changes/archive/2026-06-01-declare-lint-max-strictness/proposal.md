# Declare the Lint Max-Strictness Standard (Phase 2)

## Why

Phase 1 (`migrate-lint-to-eslint-prettier`) moved the toolchain off Biome onto
ESLint + Prettier + stylelint as a **behavior-preserving 1:1 port — no new
rules**. The whole point of that move (proposal.md §Why, point 2) was to **enable
a durable maximum-strictness regime** that Biome could not express. This change
is Phase 2: it **declares that standard** as a durable spec, without yet forcing
the codebase to comply (that is Phase 3, `ratchet-lint-to-strict`).

The declaration is decoupled from compliance on purpose: enabling rules is cheap,
but fixing ~1200 manual `strictTypeChecked` violations (file splitting for
`max-lines`, authoring JSDoc, untangling `no-unsafe-*`) is judgment-heavy work
that must be sequenced, attributable, and reviewable — not a big-bang.

## Declaration model (refines the migrate strategy table)

The `migrate-lint-to-eslint-prettier` strategy table row 2 sketched Phase 2 as
"spec **+ config** (rules present, mostly warn/staged-off)." This change
**refines that to spec-first**: the openspec spec is the single source of truth
for the standard; `eslint.config.ts` keeps the not-yet-achieved strict rules
**`off`** (a commented pointer to this spec is allowed, but no live `warn`
rules). Rationale: the ~2211 `strictTypeChecked` firings as `warn` would drown
the ~288 meaningful warns already in the gate (`exhaustive-deps`, react-hooks),
and CI is already non-gating on `warn` (commit `a19340bc` dropped
`--max-warnings=0`) — so `warn` buys visibility at the cost of signal and is not
worth it. Phase 3 flips each rule directly from absent → `error` with its fixup
wave.

## What Changes

This is primarily a **spec change**. It ADDs a new `lint-max-strictness-standard`
capability that pins, as the durable target:

- **Base:** full `strictTypeChecked` + `stylisticTypeChecked`, plus an explicit
  **documented exclude-list**. The exclude-list is **not empty** — it inherits
  the Phase-1 a11y carve-outs (below). Any further softening is a visible,
  justified entry, never a silent skip.
- **Plugin surface:** `eslint-plugin-sonarjs`, `eslint-plugin-unicorn` (pruned),
  `eslint-plugin-jsdoc` (public API only), import-boundary enforcement,
  `eslint-plugin-simple-import-sort` (net-new), and core `max-lines` /
  `max-lines-per-function`. Governing principle: **TS best practices, no
  overengineering.**
- **Thresholds:** `max-lines` 300 (`skipBlankLines`, `skipComments`); cyclomatic
  complexity ≤ 10; cognitive complexity ≤ 15. Exempt dirs (size / complexity /
  jsdoc): tests (`*.test.*`, e2e), generated (`prisma/generated`), seeds
  (`prisma/seed*.ts`), config (`*.config.ts`).
- **JSDoc public API =** exported declarations from `packages/shared` (`./` and
  `./trpc`) and `packages/ui` entry points only. `apps/*` off; tRPC routers out
  of scope (Zod schemas in `shared` already document the contract).
- **Import-boundary map** (verified clean in code today): `packages/*` ✗→
  `apps/*`; `packages/shared` ✗↔ `packages/ui`; `apps/api` ✗→ `packages/ui` /
  `apps/web`; `apps/web` ✗→ `apps/api` **except `import type`** (the AppRouter
  tRPC contract at `apps/web/src/lib/trpc.ts`).
- **unicorn off-list:** `prevent-abbreviations`, `no-null`, `no-array-reduce`,
  `no-nested-ternary`, `prefer-top-level-await`. `filename-case` (kebab) KEPT —
  repo is already 100% kebab (0 PascalCase files), so it is free.
- **Phase-1 sub-max severities reconciliation:** the a11y carve-outs are
  **inherited as documented exclusions, not reopened** (see Impact). Existing
  non-preset warns get a per-rule Phase-3 disposition recorded here.

A minimal, non-gating scaffold may be added to `eslint.config.ts`: a comment
block pointing at this spec and listing the Phase-3 ratchet targets. No live
strict rule is enabled (the gate stays exactly as green as Phase 1 left it).

## Impact

- **ADDs** capability `lint-max-strictness-standard` (new spec).
- **Depends on / sequenced after** `migrate-lint-to-eslint-prettier` (Phase 1,
  Complete). **Blocks** `ratchet-lint-to-strict` (Phase 3), which MODIFIES this
  spec's per-rule severity from target → enforced.
- **Does NOT touch a11y enforcement.** The inherited a11y carve-outs deliberately
  stay `off`; reopening them would collide with the active
  `verify-a11y-recommended-flip` (0/10) runtime sweep, which the Phase-1 handoff
  forbids interleaving. The relationship is named, the conflict avoided.
- **Boundary mechanism note:** the `apps/web` → `apps/api` type-only carve-out is
  expressible via `@typescript-eslint/no-restricted-imports` with
  `allowTypeImports: true`; the final choice of plugin (that vs
  `eslint-plugin-boundaries`) is settled at Phase-3 implementation, but the
  carve-out is asserted here as achievable.
- Risk: low. No code behavior changes; the gate is unaffected. The cost is all
  deferred to Phase 3.

## Acceptance

- `openspec validate declare-lint-max-strictness --strict` is green.
- Every locked decision in the grill (base, plugin surface, thresholds, JSDoc
  scope, boundary map, unicorn off-list, severity reconciliation) is represented
  as a requirement with at least one scenario.
- `eslint.config.ts` enables **no** new live rule; `pnpm lint` output is
  unchanged from Phase 1.

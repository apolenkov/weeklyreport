## Why

The repo grew organically: the api is already a screaming-architecture modular
monolith (`modules/<domain>/` + `infrastructure/`, with the invariant-bearing
modules already carrying the port pattern), but the web app is type-first and
partly flat — a giant `components/<domain>/` tree plus a flat `lib/` that mixes
hooks, utils, and mappers, plus separate `hooks/` and `server/` trees. One
feature's component, hook, and view-mapper live in three unrelated directories,
so a file's home is a matter of guesswork, search is hard, and no machine gate
enforces the layer graph. The target structure and the per-file placement were
already researched and written up in
`docs/architecture/TARGET-STRUCTURE-2026-07-02.md`, with a per-area file
inventory under `docs/architecture/mapping/` and per-module catalogs under
`docs/architecture/catalog/`. This change captures that migration as a tracked
plan: a deterministic grouping rule, the per-app target tree, and lint-enforced
import boundaries — reached by **finishing patterns already present**, not by a
rewrite. It is a plan, not a mandate to move files today.

## What Changes

- Adopt the target structure from `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`
  in **ordered, independently shippable slices**, one slice per future OpenSpec
  change, sequenced by blast radius on the load-bearing invariants (low→high),
  each behavior-neutral and gated on a clean target folder.
- **api:** keep `modules/<domain>/` + `infrastructure/`; complete the existing
  per-module hexagon (`domain/application/infrastructure` + ports) **only** inside
  invariant-bearing modules; thin CRUD modules stay flat.
- **web:** introduce `app/` (routing only) + `features/<domain>/` slices
  (`ui/` + `model/` + `api/`; minimal `index.ts` only where consumed) +
  `shared/`; dissolve `lib/mappers/`
  into each slice's `model/`; no web `entities/` layer, no web-side `shared/ui`
  re-implementation.
- **packages:** keep exactly two (`shared`, `ui`); lock the one-way acyclic graph.
- **Enforce import boundaries** with two mechanisms in `eslint.config.ts`:
  package-name zones extend the existing `@typescript-eslint/no-restricted-imports`
  block; the two relative-path zones (api cross-module, web cross-slice) use the
  resolver-aware `import-x/no-restricted-paths` rule, whose native `except` option
  carries the ratchet allowlist. Each new zone ratcheted (existing violations
  allowlisted, new ones error); `eslint-disable` suppression of boundary zones is
  forbidden — the config allowlist is the only grandfathering mechanism.

## Non-goals

- No product/source code is moved in THIS change — it authors the plan and the
  spec; each relocation slice is its own later change.
- No new architecture package, no CQRS/event-sourcing, no full 6-layer FSD, no
  `eslint-plugin-boundaries`/dependency-cruiser as the primary mechanism (all
  considered and rejected in `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`);
  the one new lint dependency is the narrowly-scoped `eslint-plugin-import-x`
  path rule for the two zones `no-restricted-imports` cannot express.
- No change to the package-level import boundaries already owned by
  `lint-max-strictness-standard` (see Modified Capabilities — deliberately NOT modified).

## Capabilities

### New Capabilities

- `directory-architecture-standard`: the deterministic two-axis grouping rule
  (domain first, then layer/segment), the per-app target tree (api per-module
  hexagon; web app/features/shared zones; two packages, one-way graph), the new
  machine-enforced import-boundary zones with the ratchet discipline, and the
  behavior-neutral, clean-folder-gated slice sequencing.

### Modified Capabilities

<!--
Checked lint-max-strictness-standard for a header collision on import boundaries.
Its requirement "Import boundaries enforce the monorepo dependency map" already
owns the FOUR package-level boundaries (packages/* ✗→ apps/*; shared/ui never
each other; apps/api ✗→ ui/web; apps/web → apps/api type-only) and asserts they
are verified clean. This change adds DIFFERENT, additive zones (api cross-module
internals, api domain-purity, web cross-slice, ui-domain-free) plus a ratchet
mechanism; the existing four boundaries stay clean and unchanged, so the old
requirement does not turn contradictory. Per the cross-capability delta rule,
single-home the new zones in directory-architecture-standard and record this skip
rather than emit a MODIFIED delta (which would also risk an exact-header mismatch).
The new spec explicitly states the package-level zones are NOT re-declared here.
-->

## Impact

- New spec: `openspec/specs/directory-architecture-standard/` (on archive).
- Future code slices (each a separate change) touch, in order:
  1. `eslint.config.ts` — add the ratcheted boundary zones (additive, zero moves).
  2. `apps/web/src/components/landing/` → `apps/web/src/features/landing/` (the
     pinned pilot leaf slice — fully covered by `docs/architecture/mapping/`) —
     proves the mechanic end-to-end.
  3. `apps/web/src/components/*`, `lib/mappers/*`, `hooks/*` → `features/*/…` and
     `shared/*` — one domain per change, including the giant `lead/` split.
  4. `apps/api/src/modules/{period,report-sections,review,publication}/…` → internal
     `domain/application/infrastructure`; Symbol-token repository injection; `review`
     and `publication` gain the port + contract suite they lack (`admin` stays
     MODERATE-flat, not in this slice).
  5. `apps/api/src/infrastructure/{email,bullmq}` + redis → EmailPort/QueuePort/
     CachePort, bound per module.
  6. api cross-module deep imports → facades; flip the cross-module lint zone to error.
- Reference: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md` (decisions, target
  tree, grouping rules, slices, enforcement zones); `docs/architecture/mapping/*`
  (per-area file inventory); `docs/architecture/catalog/*` (per-module catalogs).
- Load-bearing invariants respected: the api cross-module slice designs a
  `withTransaction`/UnitOfWork seam so the atomic period dual-state write and
  publish atomicity never leak `Prisma.TransactionClient`; the role-coverage gate's
  9 canonical middleware-chain builders are untouched by relocation.

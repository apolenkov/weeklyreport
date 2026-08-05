## Why

The repository's logical import boundaries are mostly sound, but several physical
directories have grown into unreadable flat inventories: `e2e/runtime-sweep`
(177 direct files), `prisma` (112), `scripts` (52), and transitional web roots.
The 2026-08-05 structure inventory also found four runnable script tests that no
normal gate executes, proving that the layout now hides ownership and coverage.

## What Changes

- Extend the directory standard beyond `apps/*/src` and `packages/*/src` to
  tooling, Prisma, E2E harnesses, and repository tests.
- Add a machine-readable ownership catalogue and a density/cohesion ratchet so a
  concern cannot silently regrow into a large flat directory.
- Rehome `scripts` by gate family with colocated tests and owned ledgers; make
  every maintained test discoverable by an explicit aggregate gate.
- Split runtime-sweep and Prisma into concern/family directories behind stable
  entrypoints, preserving behavior, seed profiles, evidence formats, and CLI names.
- Complete the canonical web migration for `report-pages`, root `lib`, hooks, and
  server code; repair the one test-only deep web import and API test-only deep
  module seams without weakening production boundaries.
- Update every live consumer atomically: package scripts, Knip, TypeScript,
  Vitest/Playwright, ESLint/dependency rules, Docker/CI, current docs, and specs.
- Re-freeze and rerun the exhaustive runtime campaign only after the new tree and
  all local gates are green.

Non-goals:

- No product behavior, database-schema, or user-visible UI change.
- No rewrite of archived OpenSpec provenance or external campaign evidence.
- No new workspace/package, speculative API hexagons, or `packages/ui` export-map
  breaking change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `directory-architecture-standard`: Extend deterministic homes, ownership,
  density limits, and import boundaries to repository tooling and harness roots.
- `lint-toolchain-ownership`: Require explicit execution coverage for every
  maintained repository test and stable aggregate gate entrypoints after moves.
- `exemplary-repo-floor`: Add current-source structural catalogue and monotonic
  flat-directory debt counters to the mechanical exemplary floor.

## Impact

Paths and internal imports change across `scripts/`, `e2e/runtime-sweep/`,
`prisma/`, selected `apps/web/src/` transitional roots, and API test harnesses.
Public product APIs and runtime evidence schemas remain stable. The evidence base
is `~/work/customreport-archive/2026-08-05-repository-structure-audit/`.

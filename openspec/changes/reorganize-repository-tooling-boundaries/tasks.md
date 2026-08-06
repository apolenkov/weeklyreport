## 1. Structural Baseline and Enforcement

- [x] 1.1 Freeze HEAD/status, direct-file counts, import edges, command consumers, and per-root digests in the external campaign archive.
- [x] 1.2 Add the machine-readable ownership catalogue and schema for `scripts`, runtime-sweep, Prisma, web transitional roots, and API test seams.
- [x] 1.3 Add the catalogue validator proving exactly one owner/target per tracked in-scope file and no stale or duplicate target.
- [x] 1.4 Add the structural density ratchet with a 30-direct-file threshold and exact non-increasing bounded-flat exceptions.
- [x] 1.5 Add repository-test discovery ownership and register the four currently orphaned Node tests; prove all 16 assertions run through the aggregate gate.
- [x] 1.6 Run the new validators against planted missing-owner, duplicate-owner, over-threshold, stale-baseline, and orphan-test fixtures.

## 2. Shared and Package Surfaces

- [x] 2.1 Catalogue `packages/shared/src/schemas` by contract domain; split only families whose internal/public consumer map stays compatible through the root facade.
- [x] 2.2 Catalogue flat `apps/web/src/shared/ui` primitives into cohesive families while preserving direct shared imports and existing report-shell/navigation groups.
- [x] 2.3 Verify package/public exports and production import-edge counts remain unchanged; defer the `packages/ui` wildcard export-map redesign as specified.

## 3. API Test Seams

- [x] 3.1 Replace period-to-weekly-report/admin deep test imports with facade exports or local test adapters.
- [x] 3.2 Replace report-sections/review-to-carry-over and report-sections deep test imports with explicit harness seams.
- [x] 3.3 Remove the remaining archive, project-activity, and publication deep test imports and prove production deep imports remain zero.
- [x] 3.4 Tighten the API test boundary ratchet to zero deep cross-module imports and run the single-worker API integration gate.

## 4. Web Canonical Homes

- [x] 4.1 Freeze a symbol/consumer map for `report-pages`, root `lib`, root hooks, `src/server`, and flat shared UI before any move.
- [x] 4.2 Move report-section-owned `report-pages` UI/model/hooks behind the report-sections facade without changing page behavior.
- [x] 4.3 Move period- and review-owned `report-pages` behavior behind their facades, leaving only genuine page composition in `report-pages`.
- [x] 4.4 Move root `lib` modules by concern to feature model/api or `shared/lib`; remove obsolete root paths and mega-barrels.
- [x] 4.5 Move generic hooks/server code to `shared/hooks` and `shared/server`, and domain hooks to the owning feature model.
- [x] 4.6 Group remaining flat shared UI primitives by cohesive family without introducing a shared mega-barrel.
- [x] 4.7 Remove the test-only viewer deep import and prove zero production and test deep cross-slice imports.

## 5. Tooling Tree

- [x] 5.1 Add and test the shared repo-root/path resolver used by moved tooling and owned data readers.
- [x] 5.2 Move the ESLint policy/suppression families with tests and update every internal import and ledger path.
- [x] 5.3 Move exemplary, React Doctor, and type-cycle families into separate `scripts/quality/<concern>` homes with each owned baseline colocated beside its validator.
- [x] 5.4 Move aggregate/cross-repo gates and evidence verifiers into cohesive `scripts/gates/<concern>` homes; keep one lint orchestrator entrypoint and no flat gate dump.
- [x] 5.5 Update all live package scripts, lint-staged, Knip, TypeScript, Docker/CI, current docs/specs, and planted path probes atomically.
- [x] 5.6 Run every script-owned Node test, scripts typecheck, ESLint, Knip, and the complete non-fail-fast lint gate; prove no stale live `scripts/<old-file>` path remains.

## 6. Runtime-Sweep Harness Tree

- [x] 6.1 Finalize the exact 180-file runtime ownership/path map and freeze serialized artifact fixtures before moves.
- [x] 6.2 Move source/manifest/matrix compilation and validation behind minimal concern entrypoints.
- [x] 6.3 Move preflight and replay preparation/execution code while preserving one-profile seed reuse and recovery semantics.
- [x] 6.4 Move evidence capture and exactly-once cell/ledger writers without changing schemas, digests, or external archive paths.
- [x] 6.5 Move fault, concurrency, infrastructure, and driver/import concerns with fail-closed cleanup and verifier contracts intact.
- [x] 6.6 Move server/environment/support code and update Playwright/Vitest/TypeScript/Knip/package consumers.
- [x] 6.7 Run all runtime-sweep unit/contract tests and revalidate the frozen pre-move artifact fixtures byte/semantic compatibility.

## 7. Prisma Tree

- [x] 7.1 Freeze the 114-file Prisma ownership/path map and retain `schema.prisma`, migrations, and root `seed.ts` as stable entrypoints.
- [x] 7.2 Move common seed support and profile contract/runner/validator code; update Prisma/e2e consumers and typecheck paths.
- [x] 7.3 Move minimal/simple seed families with their tests and run both profiles against the disposable E2E database.
- [x] 7.4 Move demo/advanced/stress seed families with their tests and prove deterministic identities/reference time.
- [x] 7.5 Move destructive guards and reset/wipe/backfill operations; prove production-target rejection and Redis cleanup behavior.
- [x] 7.6 Run Prisma typecheck, seed profile contracts/journeys, destructive target probes, reset/seed for all profiles, and stale-path search.

## 8. Repository-Wide Verification and Runtime Restart

- [ ] 8.1 Regenerate the structural inventory and require zero uncatalogued files, zero orphan tests, zero unexplained over-threshold directories, and no new deep import edge.
- [ ] 8.2 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and required single-worker integration suites; record exact commands/exits.
- [ ] 8.3 Run `openspec validate reorganize-repository-tooling-boundaries --strict` and `openspec validate establish-exhaustive-runtime-sweep --strict`.
- [ ] 8.4 Commit behavior-neutral slices, independently review exact-final-SHA moves, and require a clean worktree with preserved branch refs.
- [ ] 8.5 Freeze a new immutable runtime SOURCE/PREFLIGHT/MATRIX/MANIFEST at the final SHA; classify r29 as superseded diagnostic evidence.
- [ ] 8.6 Execute the full Playwright matrix, native Luna review/import/adjudication, confirmed fixes, final resweep, visual/log QA, and archive/OpenSpec closeout.

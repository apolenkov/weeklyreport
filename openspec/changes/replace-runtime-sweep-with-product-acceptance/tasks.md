## 1. Shared E2E foundation

- [x] 1.1 Freeze the live (non-historical) `e2e/runtime-sweep` consumer inventory and map product protections to route health, one smoke lifecycle, or an existing focused suite; verify every live consumer and required outcome has an owner before code moves.
- [x] 1.2 Rewrite the generic navigation/route-resolution behavior needed by `e2e/sweep` and product variants under `e2e/helpers/` without importing runtime-sweep code; verify focused positive, redirect, abort, and failure tests pass.
- [x] 1.3 Create the `e2e/acceptance/playwright.config.ts` foundation with `route-health` and one bounded second project, one worker, explicit loopback ports, standard reporters, and failure artifacts; verify config tests reject missing/unsafe/equal database targets and invalid port values.
- [x] 1.4 Add acceptance global setup/teardown that records SHA/tree, applies the exact destructive guard and per-run consent immediately before reset/seed, closes test clients, and proves Playwright-owned listeners are gone; verify pass, setup-failure, test-failure, timeout, and interruption probes all produce the correct cleanup result.
- [x] 1.5 Add standard Playwright report metadata for SHA/tree, browser, command kind, duration, totals, and cleanup status without a custom ledger; verify a planted failing spec retains trace/screenshot/log evidence and a passing spec emits no per-action artifacts.
- [x] 1.6 Add the whole-contour budget gate for 25 files, 4,000 lines, 10-minute smoke, 15-minute combined, and 2-minute teardown limits; verify planted file, line, duration, and missing-receipt violations fail the exact gate command.

## 2. API acceptance boundary

- [x] 2.1 Reuse the canonical API server command, health readiness, Redis configuration, PDF worker, and test log path from focused E2E infrastructure without runtime-sweep imports; verify the acceptance API boots from source and shuts down cleanly on the reserved port.
- [x] 2.2 Expose only the test read-back needed for the representative report write/publication lifecycle through existing public tRPC/test seams; verify it parses responses and introduces zero production deep-import edges.
- [x] 2.3 Prove destructive setup targets only the exact loopback `customreport_e2e` legacy technical database identifier of WeeklyReport and never `DATABASE_URL`; verify unsafe, production, encoded, query-bearing, and shared targets fail before any Prisma/Redis primitive.

## 3. Web product acceptance

- [ ] 3.1 Move the catalog route-health behavior into the new acceptance project, remove its runtime-sweep navigation dependency, and preserve four-role HTTP/console/page-error/network/axe reporting; verify every catalog route is visited and the planted axe defect fails.
- [x] 3.2 Rename and constrain the second Playwright project to `smoke-lifecycle`; verify discovery contains exactly one representative lifecycle and no separate lead/head/admin/viewer/PDF journey matrix.
- [x] 3.3 Implement the representative lead write -> head publish -> viewer read lifecycle with basic admin landing, visible outcomes, and persisted/API read-back; verify it passes from a fresh deterministic seed.
- [x] 3.4 Prove every omitted browser journey remains covered by an existing focused unit, integration, seed-profile, production-build, CSP, or authorization test; add focused tests only for an evidenced gap, not to the smoke contour.
- [x] 3.5 Verify `test:acceptance:smoke` discovers only the representative lifecycle and `test:acceptance` discovers route health plus that same lifecycle.

## 4. Tooling replacement and legacy deletion

- [x] 4.1 Add `test:acceptance`, `test:acceptance:smoke`, `lint:acceptance-budget`, and the transitional `test:uat` route-health alias; verify scripts use only pnpm/Playwright and expose no custom campaign runner.
- [x] 4.2 Update CI, pre-push, lint orchestration, Knip, TypeScript/Vitest discovery, and ownership catalogues for the new contour; verify planted unowned-file, missing-test, and budget failures reach the aggregate gate.
- [x] 4.3 Rewrite or retire each live product-variant, health-test, gate, and documentation consumer of runtime-sweep code; verify non-historical source/config paths contain zero imports from `e2e/runtime-sweep/` before deletion.
- [x] 4.4 Delete all 859 files under `e2e/runtime-sweep/` and remove every `test:runtime-*` command, runtime lane/source/manifest/driver entrypoint, and runtime-specific structural baseline; verify no compatibility shim, copied subsystem, orphan test, or live path remains.
- [ ] 4.5 Run route health, the smoke lifecycle, and focused integration, seed-profile, production-build, CSP, and authorization suites after deletion; verify each assigned product protection and the reduced budgets remain green without the legacy tree.

## 5. Planning, documentation, and owner decision

- [x] 5.1 Mark the unlaunched r6 packet `NOT_RUN_SUPERSEDED_BY_OWNER_DIRECTION`, record that no resource/browser/product effect occurred, and update the external archive index; verify its packet hashes remain historical and no launch authority survives.
- [x] 5.2 Reconcile `establish-exhaustive-runtime-sweep`, `stabilize-report-record-ordering`, `reorganize-repository-tooling-boundaries`, and `harden-preproduction-sdlc-controls` against the new acceptance contract without checking any unexecuted old task; verify strict OpenSpec validation names the exact superseded and replacement evidence.
- [x] 5.3 Update `e2e/README.md`, `docs/sdlc.md`, `docs/README.md`, onboarding commands, and repository guidance to describe WeeklyReport's bounded acceptance contour and legacy technical identifiers; verify all documented commands exist and no new prose treats CustomReport as a separate product.
- [ ] 5.4 Obtain independent architecture review of the exact deletion/replacement diff for product coverage, destructive-data safety, cleanup, complexity budgets, and absence of a recreated orchestration platform; verify all blocking findings are fixed before integration.

## 6. Final verification and integration

- [ ] 6.1 Run focused tests for acceptance helpers, config, setup/teardown, reporter metadata, budgets, route health, and the single smoke lifecycle; record exact commands, counts, durations, and exits.
- [ ] 6.2 Run `pnpm format:check`, `pnpm typecheck`, full non-fail-fast `pnpm lint`, `pnpm test`, and an explicitly configured production `pnpm build`; verify every gate table row passes.
- [ ] 6.3 Run `pnpm test:e2e:integration`, `pnpm test:e2e:seed-profiles`, `pnpm test:e2e:prodbuild`, `pnpm test:e2e:csp`, `pnpm test:acceptance:smoke`, and `pnpm test:acceptance` against the exact guarded E2E target; verify all pass within their budgets and teardown leaves no owned listeners/processes.
- [ ] 6.4 Run `pnpm exec openspec validate --all --strict`, prove a clean exact branch/HEAD/tree, confirm the six mobile changes / 15 tasks stayed untouched, and record local versus remote/CI evidence separately.
- [ ] 6.5 After implementation, deterministic gates, independent review, and remote CI are all proven, sync the delta specs and archive this change; verify WeeklyReport final acceptance cites the bounded contour rather than any retired runtime campaign.

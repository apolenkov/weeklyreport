## 1. Shared E2E foundation

- [x] 1.1 Freeze the live (non-historical) `e2e/runtime-sweep` consumer inventory and the exact four-role critical-journey denominator; verify every live consumer and every required outcome is listed before code moves.
- [x] 1.2 Rewrite the generic navigation/route-resolution behavior needed by `e2e/sweep` and product variants under `e2e/helpers/` without importing runtime-sweep code; verify focused positive, redirect, abort, and failure tests pass.
- [x] 1.3 Create `e2e/acceptance/playwright.config.ts` with `route-health` and `critical-journeys` projects, one worker, explicit loopback ports, standard reporters, and failure artifacts; verify config tests reject missing/unsafe/equal database targets and invalid port values.
- [x] 1.4 Add acceptance global setup/teardown that records SHA/tree, applies the exact destructive guard and per-run consent immediately before reset/seed, closes test clients, and proves Playwright-owned listeners are gone; verify pass, setup-failure, test-failure, timeout, and interruption probes all produce the correct cleanup result.
- [ ] 1.5 Add standard Playwright report metadata for SHA/tree, browser, command kind, duration, totals, and cleanup status without a custom ledger; verify a planted failing spec retains trace/screenshot/log evidence and a passing spec emits no per-action artifacts.
- [ ] 1.6 Add the whole-contour budget gate for 50 files, 8,000 lines, 10-minute smoke, 30-minute full, and 2-minute teardown limits; verify planted file, line, duration, and missing-receipt violations fail the exact gate command.

## 2. API acceptance boundary

- [ ] 2.1 Reuse the canonical API server command, health readiness, Redis configuration, PDF worker, and test log path from focused E2E infrastructure without runtime-sweep imports; verify the acceptance API boots from source and shuts down cleanly on the reserved port.
- [ ] 2.2 Expose test-only acceptance read-back helpers through existing public tRPC/test seams for report state, ordered records, publication, action-log, and PDF job outcomes; verify helpers parse responses and introduce zero production deep-import edges.
- [ ] 2.3 Prove destructive setup targets only the exact loopback `customreport_e2e` legacy technical database identifier of WeeklyReport and never `DATABASE_URL`; verify unsafe, production, encoded, query-bearing, and shared targets fail before any Prisma/Redis primitive.

## 3. Web product acceptance

- [ ] 3.1 Move the catalog route-health behavior into the new acceptance project, remove its runtime-sweep navigation dependency, and preserve four-role HTTP/console/page-error/network/axe reporting; verify every catalog route is visited and the planted axe defect fails.
- [ ] 3.2 Implement the lead journey for edit/autosave, deterministic item-risk-decision order, submit, and locked state with visible plus API/database read-back assertions; verify the journey passes from a fresh deterministic seed.
- [ ] 3.3 Implement the head journey for review, publish, revoke, downstream visibility, and PDF export with visible plus read-back assertions; verify publication and revocation cannot pass on UI-only or self-written fixture values.
- [ ] 3.4 Implement the admin journey for period/configuration writes, action-log search/detail/copy allowlist, and authorization; verify UI results and persisted/audit outcomes agree.
- [ ] 3.5 Implement the viewer journey for published navigation, read-only enforcement, and PDF download plus representative cross-role authorization checks; verify no viewer mutation request is emitted.
- [ ] 3.6 Add one representative end-to-end write/read journey to the `@smoke` subset and keep every other critical journey in the full project; verify smoke and full test discovery enumerate the intended stable denominator.
- [ ] 3.7 Run smoke and full acceptance once while the legacy runtime tree still exists, record actual source-file/line/duration/cleanup measurements, and verify every frozen budget passes before legacy deletion.

## 4. Tooling replacement and legacy deletion

- [ ] 4.1 Add `test:acceptance`, `test:acceptance:smoke`, `lint:acceptance-budget`, and the transitional `test:uat` route-health alias; verify scripts use only pnpm/Playwright and expose no custom campaign runner.
- [ ] 4.2 Update CI, pre-push, lint orchestration, Knip, TypeScript/Vitest discovery, and ownership catalogues for the new contour; verify planted unowned-file, missing-test, and budget failures reach the aggregate gate.
- [ ] 4.3 Rewrite or retire each live product-variant, health-test, gate, and documentation consumer of runtime-sweep code; verify non-historical source/config paths contain zero `runtime-sweep` imports before deletion.
- [ ] 4.4 Delete all 859 files under `e2e/runtime-sweep/` and remove every `test:runtime-*` command, runtime lane/source/manifest/driver entrypoint, and runtime-specific structural baseline; verify no compatibility shim, copied subsystem, orphan test, or live path remains.
- [ ] 4.5 Re-run acceptance smoke/full plus focused integration, seed-profile, production-build, and CSP suites after deletion; verify the same critical denominator and budgets remain green without the legacy tree.

## 5. Planning, documentation, and owner decision

- [ ] 5.1 Mark the unlaunched r6 packet `NOT_RUN_SUPERSEDED_BY_OWNER_DIRECTION`, record that no resource/browser/product effect occurred, and update the external archive index; verify its packet hashes remain historical and no launch authority survives.
- [ ] 5.2 Reconcile `establish-exhaustive-runtime-sweep`, `stabilize-report-record-ordering`, `reorganize-repository-tooling-boundaries`, and `harden-preproduction-sdlc-controls` against the new acceptance contract without checking any unexecuted old task; verify strict OpenSpec validation names the exact superseded and replacement evidence.
- [ ] 5.3 Update `e2e/README.md`, `docs/sdlc.md`, `docs/README.md`, onboarding commands, and repository guidance to describe WeeklyReport's bounded acceptance contour and legacy technical identifiers; verify all documented commands exist and no new prose treats CustomReport as a separate product.
- [ ] 5.4 Obtain independent architecture review of the exact deletion/replacement diff for product coverage, destructive-data safety, cleanup, complexity budgets, and absence of a recreated orchestration platform; verify all blocking findings are fixed before integration.

## 6. Final verification and integration

- [ ] 6.1 Run focused tests for acceptance helpers, config, setup/teardown, reporter metadata, budgets, route health, and all critical journeys; record exact commands, counts, durations, and exits.
- [ ] 6.2 Run `pnpm format:check`, `pnpm typecheck`, full non-fail-fast `pnpm lint`, `pnpm test`, and an explicitly configured production `pnpm build`; verify every gate table row passes.
- [ ] 6.3 Run `pnpm test:e2e:integration`, `pnpm test:e2e:seed-profiles`, `pnpm test:e2e:prodbuild`, `pnpm test:e2e:csp`, `pnpm test:acceptance:smoke`, and `pnpm test:acceptance` against the exact guarded E2E target; verify all pass within their budgets and teardown leaves no owned listeners/processes.
- [ ] 6.4 Run `pnpm exec openspec validate --all --strict`, prove a clean exact branch/HEAD/tree, confirm the six mobile changes / 15 tasks stayed untouched, and record local versus remote/CI evidence separately.
- [ ] 6.5 After implementation, deterministic gates, independent review, and remote CI are all proven, sync the delta specs and archive this change; verify WeeklyReport final acceptance cites the bounded contour rather than any retired runtime campaign.

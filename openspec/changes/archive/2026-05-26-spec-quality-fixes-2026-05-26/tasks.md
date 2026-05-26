# Tasks

## Category A — text fixes

- [x] `archive-history-ia/spec.md`: add H1 header, remove "approximately", add component refs
- [x] `landing-page-hero/spec.md`: add `TaglineCycler` + `LANDING_TAGLINES` consumer surfaces
- [x] `repository-scope-guard/spec.md`: fill TBD Purpose; reframe Req 2 as durable invariant
- [x] `status-slide-rendering/spec.md`: fill TBD Purpose; reword R1 as behavior invariant
- [x] `period-dual-state/spec.md`: add atomicity test scenario

## Category B — decision-backed

- [x] `role-coverage-gate/spec.md`: 7→8, list all 8 builder names
- [x] `period-lifecycle-ui/spec.md`: fill TBD Purpose; fix status enum; add tRPC + component refs
- [x] `report-routing/spec.md`: fill TBD Purpose; commit to path segment; name route files
- [x] `trpc.router.ts:1832`: **no change needed** — `headProcedure = buildRoleMiddleware(["head","admin"])` already covers both

## Closeout

- [x] `pnpm typecheck && pnpm lint` green
- [x] Commit + push

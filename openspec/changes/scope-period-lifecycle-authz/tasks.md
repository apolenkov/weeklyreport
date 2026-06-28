## 1. API: repository port + active-target resolution

- [ ] 1.1 Extend the `PeriodRepository` interface in `apps/api/src/modules/period/period.service.ts` with a current-active-editable resolver and a latest-published resolver (mirroring `getCurrentEditableId` / `getLatestPublishedId` semantics from `weekly-report.prisma-repository.ts`); include `archived` in the `getReportById` projection.
- [ ] 1.2 Implement the two resolvers and the `archived` field in `apps/api/src/modules/period/period.prisma-repository.ts`, reusing the exact non-archived / `periodStart <= now` / `periodStatus` query shapes so the head's active target matches the weekly-report page resolver.

## 2. API: service authorization + archived rejection

- [ ] 2.1 Add a typed domain error for out-of-scope/archived denials (a `PeriodScopeError`, or extend the existing `PeriodAccessError` family) in `apps/api/src/modules/period/period.service.ts`.
- [ ] 2.2 In `publishPeriod`, reject archived reports for all roles, and for a non-admin `head` require `reportId` to equal the resolved active editable id (reject mismatch with the typed error); admin skips the equality check. No silent retarget.
- [ ] 2.3 In `reopenPeriod`, accept `session`, reject archived reports for all roles, and for a non-admin `head` require `reportId` to equal the resolved latest-published id; admin skips the equality check. Keep the existing UFB-052 reopen-policy gates unchanged.

## 3. API: tRPC wiring + error mapping

- [ ] 3.1 In `apps/api/src/infrastructure/trpc/trpc.router.ts`, thread `ctx.session` into the `period.reopen` mutation call (publish already passes it); both mutations stay on `headProcedure`.
- [ ] 3.2 Add the `FORBIDDEN` (out-of-scope / archived) and `NOT_FOUND` (missing report) branches for the period domain error in `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`, following the `requestReopen` convention; never leak internal detail.

## 4. Tests

- [ ] 4.1 Service unit tests: head publish/reopen on the active target succeeds; head on a stale/foreign id is rejected; admin on an arbitrary non-archived id succeeds; archived target is rejected for both head and admin.
- [ ] 4.2 Service unit test: head publish/reopen when no active target exists is rejected (no write, no telemetry increment).
- [ ] 4.3 Error-mapper / router test: out-of-scope denial maps to `FORBIDDEN`, missing report maps to `NOT_FOUND`, neither surfaces as `INTERNAL_SERVER_ERROR`.

## 5. Verification

- [ ] 5.1 Run `openspec validate "scope-period-lifecycle-authz" --strict` and confirm it exits 0.
- [ ] 5.2 Run `pnpm typecheck && pnpm lint && pnpm test` and confirm the gates stay green.

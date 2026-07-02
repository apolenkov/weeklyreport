## 1. API: shared active-target resolvers + head default convergence

- [ ] 1.1 In `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`, add `getLatestPublishedNonArchivedId` (newest `published` with `archived: false`, `orderBy periodStart desc, id desc`) alongside the existing `getCurrentEditableId` / `getLatestPublishedId`. Do NOT reuse or mutate `getLatestPublishedId` (it feeds the viewer default-report fallback).
- [ ] 1.2 In `apps/api/src/modules/weekly-report/weekly-report.service.ts`, migrate the `head` branch of `resolveDefaultReportId` from `getActiveReportId` to `getCurrentEditableId() ?? getLatestPublishedNonArchivedId()`. Keep the `lead` branch on `getActiveReportId` (no lifecycle gate → no divergence to close) and leave the viewer branch unchanged. This is the fix for the head's submitted `reportId` and the lifecycle authz target diverging.
- [ ] 1.3 Expose `getCurrentEditableId` and `getLatestPublishedNonArchivedId` to `PeriodService` through its repository port (interface in `apps/api/src/modules/period/period.service.ts`), reusing the SAME query definitions — do not author a second copy of the resolvers inside the period repository. Include `archived` in the `getReportById` projection.

## 2. API: service authorization + archived rejection

- [ ] 2.1 Add **two distinct** typed domain errors in `apps/api/src/modules/period/period.service.ts`: `PeriodScopeError` (out-of-scope / archived denial → `FORBIDDEN`) and `PeriodNotFoundError` (missing report → `NOT_FOUND`). Do **not** overload the existing `PeriodAccessError`, and do not add a mapper branch for it — it keeps carrying the UFB-052 state/policy errors unchanged (mapping it would reclassify those, a non-goal).
- [ ] 2.2 Replace the bare `throw new Error("Report … not found.")` in **both** `publishPeriod` (~`period.service.ts:101`) and `reopenPeriod` (~`:146`) with `throw new PeriodNotFoundError(...)` so a missing report becomes `NOT_FOUND`, not `INTERNAL_SERVER_ERROR`.
- [ ] 2.3 In `publishPeriod`, reject archived reports for all roles, and for a non-admin `head` require `reportId` to equal the resolved active editable id (reject mismatch with `PeriodScopeError`); admin skips the equality check. No silent retarget.
- [ ] 2.4 In `reopenPeriod`, accept `session`, reject archived reports for all roles, and for a non-admin `head` require `reportId` to equal the resolved latest-published non-archived id (reject mismatch with `PeriodScopeError`); admin skips the equality check. Keep the existing UFB-052 reopen-policy gates unchanged.

## 3. API: tRPC wiring + error mapping

- [ ] 3.1 In `apps/api/src/infrastructure/trpc/trpc.router.ts`, thread `ctx.session` into the `period.reopen` mutation call (publish already passes it); both mutations stay on `headProcedure`.
- [ ] 3.2 Add two `instanceof` branches in `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`: `PeriodScopeError → FORBIDDEN` and `PeriodNotFoundError → NOT_FOUND`, following the `requestReopen` convention; never leak internal detail. Map **only** these two new classes — do not add a `PeriodAccessError` branch.

## 4. Tests

- [ ] 4.1 Service unit tests: head publish/reopen on the active target succeeds; head on a stale/foreign id is rejected; admin on an arbitrary non-archived id succeeds; archived target is rejected for both head and admin.
- [ ] 4.2 Service unit test: head publish/reopen when no active target exists is rejected (no write, no telemetry increment).
- [ ] 4.3 Error-mapper / router test: out-of-scope denial maps to `FORBIDDEN`, missing report maps to `NOT_FOUND`, neither surfaces as `INTERNAL_SERVER_ERROR`.
- [ ] 4.4 Service unit test (the archived-latest reopen case): when the newest `published` row is archived and an older `published` row is non-archived, the latest-published-non-archived resolver returns the non-archived id, and a head reopening that non-archived id succeeds (proves the resolver diverges from `getLatestPublishedId` and is not blocked by the archived guard).
- [ ] 4.5 Weekly-report service test (head default convergence): a `head` with no `reportId` resolves its default report via `getCurrentEditableId() ?? getLatestPublishedNonArchivedId()` (NOT `getActiveReportId`), so the head's default `reportId` equals the lifecycle authz target. Cover the archived-newest-published case (head default lands on the older non-archived published id). Assert `lead` still resolves via `getActiveReportId` and the viewer path is unchanged.

## 5. API: admin manual-edit published guard

- [ ] 5.1 In `apps/api/src/modules/admin/period-admin.service.ts` `updatePeriodManual`, after the per-field diff is computed and before the overlap gate / write, reject when `existing.periodState === "published"` AND the diff changes any of `periodStart` / `periodEnd` / `deadline`. Throw `AdminAccessError` (reuse the existing class `deleteReport` already uses → `FORBIDDEN`); message mirrors `deleteReport` ("Cannot edit a published period's dates. Reopen it first if needed."). Do NOT block a `weekLabel`-only edit or an edit on a non-`published` period, and do NOT add a new error class or mapper branch.
- [ ] 5.2 Service unit tests (`period-admin.service.test.ts`): admin envelope edit on a `published` period is rejected (no write); a `weekLabel`-only edit on a `published` period succeeds; an envelope edit on an `open`/reopened period succeeds (boundary). Assert the rejection maps to `FORBIDDEN` via the error mapper, matching `deleteReport`'s published-delete test.

## 6. Verification

- [ ] 6.1 Run `openspec validate "scope-period-lifecycle-authz" --strict` and confirm it exits 0.
- [ ] 6.2 Run `pnpm typecheck && pnpm lint && pnpm test` and confirm the gates stay green.

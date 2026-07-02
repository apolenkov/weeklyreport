## 1. API — repository (lead-form.prisma-repository.ts)

- [ ] 1.1 Add a scoped single-section load for the revoke path: a `findFirst` keyed by `id` plus the caller's `reportSection` scope fragment spread into the `where` (relation filter on a READ — supported). Do NOT change the shared `getSectionById` signature; add a new method or a `scope` param defaulting to `{}`.
- [ ] 1.2 Single-section write stays scalar: after the scoped read validates the id, flip via `updateMany({ where: { id, status: "submitted" } })` on the validated id. The scope is not repeated in the write — the scoped read already proved the id is in scope (not because Prisma forbids it; `updateMany.where` does accept the `author` relation filter).
- [ ] 1.3 Scope the bulk path with one `updateMany`: in `revokeAllSubmitted`, spread the scope straight into the write — `updateMany({ where: { reportId, status: "submitted", ...scope } })` (`updateMany.where` accepts the `author` relation filter, so no collect-ids step is needed). Keep the `status: "submitted"` predicate for race-safety, keep the existing method shape, and return the count.
- [ ] 1.4 Update the `LeadFormRepository` interface in `lead-form-shared.ts` so both revoke methods accept the scope fragment.

## 2. API — service (lead-form.service.ts)

- [ ] 2.1 `revokeSubmission`: accept a scope fragment, load via the scoped read; on null (out-of-group OR missing) throw the typed `LeadFormDomainError` (maps to `NOT_FOUND`) instead of the current plain `Error` (which finding P1-7 shows surfaces as 500); keep the `submitted`-only precondition; call the scalar write on the validated id.
- [ ] 2.2 `revokeAllSubmitted`: accept and forward the scope fragment to the repository; keep returning `{ success: true, revokedCount }`.

## 3. API — router (trpc.router.ts)

- [ ] 3.1 `revoke` procedure: build `groupScopeFilter(ctx.session, "reportSection")` and pass it into `revokeSubmission` (mirror the `respondReopenRequest` callsite); keep `mapDomainError`.
- [ ] 3.2 `revokeAllSubmitted` procedure: build the same scope fragment and pass it into the service call; keep it a `headProcedure` (role-coverage gate unchanged).

## 4. API — regression test

- [ ] 4.1 Add a test that drives the `leadForm.revoke` / `leadForm.revokeAllSubmitted` tRPC procedures through an `appRouter` caller (head session) — NOT the service in isolation — so the router scope-threading (tasks 3.1/3.2) is covered end to end; mirror `reopen-requests.router.test.ts`. Fixture: a group-A head and submitted group-B sections. (Co-locate with the other router tests under `apps/api/src/infrastructure/trpc/` or under `apps/api/src/modules/report-sections/` so long as it invokes through the router.)
- [ ] 4.2 Assert `revoke` of a group-B section rejects as not-found and the group-B section stays `submitted`.
- [ ] 4.3 Assert `revokeAllSubmitted` on a multi-group report revokes only group-A sections and returns the group-A `revokedCount` (group-B rows untouched); add the `revokedCount: 0` no-in-group-submissions case.
- [ ] 4.4 Assert the admin path stays global: admin `revoke` / `revokeAllSubmitted` mutate sections regardless of author group.

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck` — green.
- [ ] 5.2 Run `pnpm lint` — green.
- [ ] 5.3 Run `pnpm test` (at least the new test plus the existing lead-form suite) — green, and confirm the new test fails when the scope is reverted (proves teeth).
- [ ] 5.4 Run `pnpm build` — green.
- [ ] 5.5 Run `openspec validate "scope-leadform-revoke-authz" --strict` — exits 0.

## 1. Repository scope filter (apps/api)

- [ ] 1.1 Import `groupScopeFilter` and `guardGroupScope` from `../../lib/group-scope.js` into `analytics.prisma-repository.ts`.
- [ ] 1.2 Add a `session: UserSession` parameter to `trafficLightHistory`, `leadVelocity`, and `periodComparison`; call `guardGroupScope(session)` at the top of each.
- [ ] 1.3 In `trafficLightHistory`, apply `groupScopeFilter(session, "reportSection")` to the nested `include.sections.where` (the load-bearing fix), and add `sections: { some: { ...existingLeadFilter, ...scope } }` to the top-level report `where` to drop empty periods; omit both when the filter is empty (admin).
- [ ] 1.4 In `leadVelocity`, merge the scope into the nested `include.sections.where` alongside the existing `status: "submitted"` filter, and add `sections: { some: <scope> }` to the report `where` (admin → omit both).
- [ ] 1.5 In `periodComparison`, apply the scope to the `fetchOne` nested `include.sections.where`, and add `sections: { some: <scope> }` to the `fetchOne` report `where` (admin → omit both).
- [ ] 1.6 Confirm `PUBLISHED_FLOOR`, the period/lead/project filters, and the `submitted` section filter are preserved alongside the new scope clauses in all three methods.

## 2. Service + interface threading (apps/api)

- [ ] 2.1 Add `session: UserSession` to the three method signatures on the `AnalyticsRepository` interface in `analytics.service.ts`.
- [ ] 2.2 Add `session: UserSession` to the matching `AnalyticsService` methods and forward it to the repository call.
- [ ] 2.3 Add a scope-discriminator helper (`"admin"` for admin, else sorted authorised group ids joined by a UUID-safe delimiter) and prepend it to each cache key alongside `stableHash(parsed)`.
- [ ] 2.4 Decide reuse vs new helper for the discriminator (export `computeAllowedGroupIds` or add `scopeDiscriminator(session)` in `group-scope.ts`) so it derives from the same source as `groupScopeFilter`.

## 3. tRPC wiring (apps/api)

- [ ] 3.1 In the `analytics` router block of `trpc.router.ts`, pass `ctx.session` into `analyticsService.trafficLightHistory`, `leadVelocity`, and `periodComparison` from each resolver.
- [ ] 3.2 Confirm the procedures stay `anyRoleProcedure` (no role-coverage-gate change) and the tRPC input schemas in `@customreport/shared` gain no session/scope field.

## 4. Tests (apps/api)

- [ ] 4.1 In `analytics.service.test.ts`, add cache-key isolation tests: two non-admin sessions with different group sets miss each other's entry; admin vs non-admin differ; identical scope + input is a cache hit.
- [ ] 4.2 Add a repository/integration test seeding ONE unified published period report holding both a group-A and a group-B section (a two-single-group-reports fixture would false-green the nested-include leak); assert a group-A non-admin caller's `trafficLightHistory`, `leadVelocity`, and `periodComparison` return no group-B data.
- [ ] 4.3 Add a guard test: calling a repository method without a session throws via `guardGroupScope`; a defined admin session passes and reads unfiltered.

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck`.
- [ ] 5.2 Run `pnpm lint`.
- [ ] 5.3 Run `pnpm test` (focus `apps/api` analytics + group-scope suites).
- [ ] 5.4 Run `pnpm build`.
- [ ] 5.5 Run `openspec validate "scope-analytics-to-group" --strict` and confirm it exits 0.

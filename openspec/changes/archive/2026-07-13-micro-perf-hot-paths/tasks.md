## 1. Org hydration: read-only on the common path

- [ ] 1.1 `trpc.session-hydration.ts`: in `hydrateOrganization`'s cache-miss
      branch, replace the unconditional `prisma.organization.upsert` with
      `prisma.organization.findUnique({ where: { id: "singleton" }, select:
{ shortName: true, fullName: true } })`; only when that returns `null`
      fall back to the existing `create`-shaped write (same `DEFAULT_ORGANIZATION_IDENTITY`
      defaults), mirroring `organization.prisma-repository.ts`'s
      `getOrganization` pattern
- [ ] 1.2 Keep the 5s TTL cache (`orgCache`) and `clearOrgCache` unchanged —
      this task only changes what happens on a cache miss
- [ ] 1.3 Acceptance: add/extend a unit test for `hydrateSession` (or its
      existing session-hydration test file) asserting that when the
      singleton row already exists, `hydrateOrganization` calls
      `organization.findUnique` and never calls `organization.upsert`; a
      second case asserts the absent-row fallback still creates the row

## 2. Weekly report: parallelize the reminder-policy count

- [ ] 2.1 `weekly-report.prisma-repository.ts`: move the
      `reminderPolicy.count` query into the existing
      `Promise.all([leadUsers, projects])`, making it
      `Promise.all([leadUsers, projects, activePolicyCount])`; its `where`
      clause is unchanged (`active: true`, `validFrom`/`validUntil` against
      `report.deadline`), only its dispatch timing moves — `report.deadline`
      is already available from the `report` fetched earlier in the method
- [ ] 2.2 Acceptance: existing `getWeeklyReport` unit/integration tests for
      `hasActiveReminderRule` (both the live and published branches) stay
      green unmodified in behavior; add a test-double assertion (or a spy on
      the Prisma mock) that `reminderPolicy.count` is invoked without
      awaiting `leadUsers`/`projects` first — i.e. it is part of the same
      `Promise.all` batch, not a subsequent `await`

## 3. Weekly report: skip stageAssignments on the published branch

- [ ] 3.1 `weekly-report.prisma-repository.ts`: branch the `projects` query
      shape on the already-known `report.periodStatus` — when
      `report.periodStatus === "published"`, query with
      `select: { id: true, lead: { select: { reportingGroupId: true } } }`
      instead of the current `include: { stageAssignments: true, lead: {
select: { reportingGroupId: true } } }`; keep the full
      `stageAssignments` include for every non-published `periodStatus`
      (the live branch, which feeds `buildPortfolioOverview`)
- [ ] 3.2 Confirm (read, don't change) that the published branch's only uses
      of `projects` are `computeCrossGroupSignal(session, projects.filter(...))`
      and the `surfacedProductIds` filter, both of which only touch `id` and
      `lead.reportingGroupId` — if `fix-published-crossgroup-audit` has
      landed first and added new fields to that computation, extend the
      published-branch `select` to cover them instead of reintroducing the
      full `include`
- [ ] 3.3 Acceptance: existing published-report `getWeeklyReport` tests
      (cross-group signal, portfolio overview built from the snapshot) stay
      green; add a test-double assertion that the published-path Prisma call
      does not request `stageAssignments`, while the live-path call still
      does

## 4. Verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 `openspec validate micro-perf-hot-paths --strict`

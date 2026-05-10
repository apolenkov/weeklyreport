# Phase 46: Group-Scope Visibility — Context

**Gathered:** 2026-05-10 (in-chat surface during UFB-038 head-vs-admin separation)
**Status:** Ready for execution
**Mode:** Standard horizontal — helper → service callsites → tests → audit
**Driver:** UFB-040 (heads see all groups; viewer Дарья sees all reports — should be scoped)

<domain>
## Phase Boundary

After UFB-038 split head from admin (commit `a94a482`) and UFB-039 added
`ReportingGroup.headUserId` + `ViewerGroupAccess` (commit `f10857a`), the API
still returns global lists regardless of who asks. A head from group A can
still read sections, dashboards, leads, and projects belonging to group B
because the service-layer queries do not filter by group.

This phase wires the schema additions into actual visibility:

- **lead** — only sees their own ReportSection (already enforced in places; double-check)
- **head** — only sees rows where `User.reportingGroupId = head.reportingGroupId`
- **viewer** — only sees rows where `User.reportingGroupId IN (viewer's ViewerGroupAccess group ids)`
- **admin** — sees everything (god-mode unchanged)

**In scope:**

- A `groupScopeFilter(session)` helper in `apps/api/src/lib/group-scope.ts` returning a Prisma `where` fragment per role
- Apply to: `dashboard`, `archive.list`, `archive.detail`, `weeklyReport.get`, `admin.snapshot.users` (when read by non-admin), `search.byScope`
- Audit-log entry when a head/viewer attempts a row outside their scope (`scope-denied` event)
- Integration tests proving cross-group leaks are blocked

**Out of scope:**

- UI changes — frontend will benefit transparently (same endpoints return less)
- Multi-tenant header enforcement (separate Phase if ever needed)
- Migrating existing audit-log rows
- Email reminder fan-out scoping (already correctly per-rule per-recipient)
  </domain>

<decisions>
## Implementation Decisions

- **Helper location: `apps/api/src/lib/group-scope.ts`.** Centralizes the WHERE-fragment builder so every service uses identical semantics. Inline filters at each callsite drift over time.

- **Returns Prisma `where` fragments, not full filters.** Each callsite spreads
  the fragment into its own `findMany({ where: { ...other, ...scopeFilter } })`. Keeps the helper composable.

- **Helper signature:**

  ```ts
  type ScopeFor =
    | { kind: 'user' }                          // filter on User.reportingGroupId
    | { kind: 'reportSection' }                 // filter on ReportSection.author.reportingGroupId
    | { kind: 'project' };                       // filter on Project.lead.reportingGroupId
  function groupScopeFilter(session: UserSession, target: ScopeFor): Prisma.* WhereInput;
  ```

  Three target shapes cover ~all read paths.

- **Admin returns `{}` (no filter).** Not `undefined` — explicit empty object so spread is always safe.

- **Viewer access is loaded once per request, not per row.** Add `viewerGroupAccess` to the loaded `UserSession` (extend the session shape) so the helper does not have to query Prisma. Falls back to empty array if absent.

- **Lead enforcement stays at the service layer (existing pattern).** This phase does not touch `report-sections.service` lead paths because they already filter by `authorId === session.userId`. Phase only affects multi-row read paths.

- **`scope-denied` audit event.** When a head/viewer requests a specific id and it falls outside their scope, log it (analogous to the existing `role-denied`) before returning 404. Helps detect probing or stale UI state.
  </decisions>

<code_context>

## Existing Code Insights

- `apps/api/src/lib/audit-logger.ts` — has `roleDenied`. Mirror with `scopeDenied`.

- `apps/api/src/modules/review/review.service.ts` — `getSubmissionDashboard(reportId)` returns all section rows for the report. Add a session arg + filter.

- `apps/api/src/modules/archive/archive.service.ts` — `list(input)` returns published reports. Apply scope filter when role !== 'admin'.

- `apps/api/src/modules/weekly-report/weekly-report.service.ts` — `get(reportId, session)` aggregates sections for one report. Filter sections by scope.

- `apps/api/src/modules/admin/admin.prisma-repository.ts:204` — `getSnapshot()` runs as headProcedure (now adminProcedure after UFB-038). Admin-only → no scope filter needed here.

- `apps/api/src/modules/search/search.service.ts:63` — already has a partial role-aware branch. Replace with the canonical helper.

- `apps/api/src/infrastructure/trpc/trpc.context.ts` — extends UserSession before passing to procedures. Hydrate `viewerGroupAccess` here.

- `packages/shared/src/auth/user-session.ts` (or wherever the session schema lives) — extend `UserSession` with optional `viewerGroupAccess: string[]`.
  </code_context>

<specifics>
## Specific Ideas

- **46-01 helper API:**

  ```ts
  export type ScopeTarget = "user" | "reportSection" | "project";

  export function groupScopeFilter(
    session: UserSession,
    target: ScopeTarget,
  ): Record<string, unknown> {
    if (session.role === "admin") return {};
    const groupIds = computeAllowedGroupIds(session);
    if (groupIds.length === 0) return { id: { in: [] } };
    switch (target) {
      case "user":
        return { reportingGroupId: { in: groupIds } };
      case "reportSection":
        return { author: { reportingGroupId: { in: groupIds } } };
      case "project":
        return { lead: { reportingGroupId: { in: groupIds } } };
    }
  }

  function computeAllowedGroupIds(session: UserSession): string[] {
    if (session.role === "head" || session.role === "lead")
      return [session.reportingGroupId];
    if (session.role === "viewer") return session.viewerGroupAccess ?? [];
    return [];
  }
  ```

- **46-02 dashboard wiring:** `reviewService.getSubmissionDashboard(reportId, session)` adds `where: { ...byReport, ...groupScopeFilter(session, 'reportSection') }` to its ReportSection query.

- **46-03 archive wiring:** `archive.list` already paginates published reports. Scope = filter sections inside each Report by `groupScopeFilter(session, 'reportSection')`. Reports themselves stay visible (they're global), but the assembled view shows only the viewer's slice.

- **46-04 weeklyReport.get:** same as dashboard — section list filtered.

- **46-05 audit:** `scopeDenied({ userId, role, attemptedScope, resourceId })` event. Emit from each service when an explicit `findUnique({id})` returns a row outside the helper's allow-list.
  </specifics>

<deferred>
## Deferred Ideas

- Per-group head dashboards (admin sees N dashboards, one per group). v9.0 multi-tenancy.
- Group-aware search relevance ranking. Search currently has scope='all' vs scope='mine' — could grow finer-grained scoping when org has many groups.
- Self-service viewer access requests ("I want to see group X" → admin approves). Out of v8.1.
- Group-aware analytics dashboards (Trends by group). Phase 47 candidate.
  </deferred>

## Verification Targets

After Phase 46 lands:

```bash
# 1. helper tested in isolation
pnpm --filter @customreport/api test -- group-scope

# 2. cross-group leak blocked end-to-end
pnpm --filter @customreport/api test -- group-scope.integration

# 3. existing api regression still green
pnpm --filter @customreport/api test
```

Manual smoke (after `pnpm db:reset:hard`):

```
log in as head of "Core Development" group → /head/dashboard
  → assert leads from other groups DO NOT appear in the section list

log in as viewer Дарья (granted access to Core Development only)
  → /reports?tab=published → opens Week 18 → assert sections only from
  her granted groups
```

## Acceptance Gate

Phase 46 closes when:

1. ✓ `groupScopeFilter` helper exists, exported, unit-tested
2. ✓ `UserSession` carries `viewerGroupAccess: string[]` (hydrated in trpc.context)
3. ✓ Dashboard / archive / weeklyReport.get all use the helper
4. ✓ `audit-logger.scopeDenied` emits on cross-scope `findUnique`
5. ✓ Integration test proves a head of group A cannot read a section authored by a lead in group B
6. ✓ 660+ api tests still green

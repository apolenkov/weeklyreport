## ADDED Requirements

### Requirement: Analytics Read Methods Bind Every Report Query to the Caller's Group Scope

The analytics repository read methods `trafficLightHistory`, `leadVelocity`, and `periodComparison` (`apps/api/src/modules/analytics/analytics.prisma-repository.ts`) MUST restrict every aggregated section to one authored within the caller's authorised reporting group(s). A single `Report` row is a unified period that holds sections from ALL groups, so the scope MUST be applied to the nested `include.sections.where` that the methods aggregate over — not only to the top-level report filter. Filtering only which reports return is insufficient: a report matching on one group-A section would still include group-B sections and leak their projects, leads, and risks.

The scope MUST be the `groupScopeFilter(session, "reportSection")` fragment, applied to the included sections exactly as `weekly-report.prisma-repository.ts` applies it. The methods MAY also keep a top-level `sections.some` predicate to drop periods with no in-scope section. An admin session MUST remain unfiltered (the nested section `where` is omitted). A non-admin caller MUST NOT receive any project status, lead, or risk drawn from a section outside its group, even when that section shares a report with an in-scope section.

The `published` floor and the existing `leadId` / `projectId` / period filters and the `leadVelocity` `status: "submitted"` section filter MUST be preserved alongside the scope filter, not replaced by it.

#### Scenario: Head reads a shared period that also holds another group's sections

- **GIVEN** one unified period `Report` containing both a group-A section and a group-B section
- **AND** a head authenticated for reporting group A
- **WHEN** the head calls `analytics.trafficLightHistory` over that period
- **THEN** the result contains only projects, leads, and risks drawn from the group-A section
- **AND** no project, lead, or risk from the co-located group-B section appears

#### Scenario: Admin reads unscoped

- **GIVEN** an admin session
- **WHEN** the admin calls any of the three analytics read methods
- **THEN** `groupScopeFilter` returns no filter and the query spans every group's published reports

#### Scenario: Viewer with no granted groups gets zero rows

- **GIVEN** a viewer whose granted group access list is empty
- **WHEN** the viewer calls `analytics.leadVelocity`
- **THEN** the scope filter resolves to a zero-row predicate and the result is empty
- **AND** no report from any group is returned

#### Scenario: Published floor and lead filter survive scoping

- **GIVEN** a non-admin caller passing a `leadId` to `analytics.trafficLightHistory`
- **WHEN** the query runs
- **THEN** the result is restricted to published reports AND to that lead AND to the caller's group scope simultaneously

### Requirement: Analytics tRPC Procedures Thread the Authenticated Session

The three analytics tRPC procedures (`analytics.trafficLightHistory`, `analytics.leadVelocity`, `analytics.periodComparison` in `apps/api/src/infrastructure/trpc/trpc.router.ts`) MUST pass `ctx.session` into the corresponding `AnalyticsService` method, which MUST pass it on to the repository. The tRPC input schemas in `@customreport/shared` MUST NOT carry the session — the scope source is the authenticated context, never client input.

#### Scenario: Procedure forwards ctx.session

- **GIVEN** an authenticated request to `analytics.periodComparison`
- **WHEN** the procedure resolver runs
- **THEN** it invokes `analyticsService.periodComparison` with both the parsed input and `ctx.session`

#### Scenario: Session is not accepted from client input

- **GIVEN** a request whose JSON body attempts to supply a `session` or group-scope field
- **WHEN** the analytics input schema parses the body
- **THEN** the field is rejected or ignored and the effective scope is derived only from the authenticated session

### Requirement: Analytics Cache Is Partitioned by Caller Scope

The analytics Redis cache key MUST incorporate a scope discriminator derived from the caller's session so a result computed for one group is never served from cache to a caller in a different scope. The discriminator MUST distinguish admin (unfiltered) from each distinct set of authorised group ids; two callers with different authorised group sets MUST compute distinct cache keys for otherwise-identical input.

#### Scenario: Two heads in different groups do not share a cache entry

- **GIVEN** head A and head B in different reporting groups issuing the same `trafficLightHistory` input
- **WHEN** head A's call populates the cache and head B then calls
- **THEN** head B's request misses head A's entry and computes its own group-B-scoped result

#### Scenario: Admin and non-admin do not share a cache entry

- **GIVEN** identical analytics input from an admin and from a head
- **WHEN** both requests are cached
- **THEN** the two requests resolve to different cache keys

#### Scenario: Same scope reuses the cache entry

- **GIVEN** two requests from callers with the identical authorised group set and identical input
- **WHEN** the second request runs after the first populated the cache
- **THEN** the second request is a cache hit and returns the same scoped result

### Requirement: Analytics Repository Entry Fails Loud on a Missing Session

Each analytics repository read method MUST call `guardGroupScope(session)` at its entry so a caller that omits the session raises a BUG-level error before any query runs, rather than silently returning unscoped cross-group data. A defined admin session MUST NOT trigger the guard (admin is legitimately unfiltered).

#### Scenario: Missing session is rejected

- **GIVEN** a programmatic caller that invokes an analytics repository method without a session
- **WHEN** the method runs
- **THEN** `guardGroupScope` throws before the Prisma query executes
- **AND** no rows are read

#### Scenario: Admin session passes the guard

- **GIVEN** a defined admin session
- **WHEN** the method runs
- **THEN** the guard does not throw and the unfiltered query proceeds

### Requirement: Regression Test Proves Cross-Group Analytics Reads Are Denied

A regression test MUST authenticate a non-admin caller for group A and assert that none of the three analytics read paths return any data belonging to group B. The fixture MUST include at least one unified period `Report` that holds BOTH a group-A and a group-B section, because two separate single-group reports would pass even if the nested-section scope were missing (a false green).

#### Scenario: Group-A caller cannot see group-B sections of a shared report

- **GIVEN** a seeded published period `Report` containing one group-A section and one group-B section
- **WHEN** a group-A non-admin caller runs `trafficLightHistory`, `leadVelocity`, and `periodComparison`
- **THEN** every returned row, lead, project, and risk belongs to group A
- **AND** no group-B identifier appears in any result

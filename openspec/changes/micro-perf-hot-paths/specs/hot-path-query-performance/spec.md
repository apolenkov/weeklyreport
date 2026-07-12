## ADDED Requirements

### Requirement: Session-hydration organization read does not write on a cache miss

`hydrateSession`'s organization-hydration step MUST read the `Organization`
singleton with `findUnique` on a cache miss and only fall back to a write
(`create`/`upsert`) when the row is absent, so a normal 5-second-TTL cache
refresh on the authenticated request hot path does not take a write lock on
every concurrent cold request.

#### Scenario: Cache-miss read of an existing organization performs no write

- **GIVEN** the `Organization` singleton row already exists
- **AND** the 5-second TTL cache has expired
- **WHEN** an authenticated request triggers `hydrateOrganization`
- **THEN** it re-populates the cache via `findUnique` without performing a
  write

#### Scenario: Absent singleton row is created once

- **GIVEN** the `Organization` singleton row does not exist
- **WHEN** `hydrateOrganization` runs on a cache miss
- **THEN** it falls back to creating the row with the default identity,
  after which subsequent reads within the TTL are served from cache without
  a write

### Requirement: Weekly-report reminder-policy count runs alongside the other independent reads

`getWeeklyReport` MUST dispatch its `reminderPolicy.count` query concurrently
with the `leadUsers` and `projects` queries (in the same `Promise.all`
batch) rather than awaiting it afterward as a separate round-trip, since it
depends only on the already-fetched `report.deadline`.

#### Scenario: Reminder-policy count is part of the concurrent batch

- **GIVEN** a request that builds a weekly report
- **WHEN** the repository fetches `leadUsers`, `projects`, and the active
  `reminderPolicy` count
- **THEN** all three queries are dispatched concurrently and awaited
  together, not with the count issued as a subsequent serial `await`

### Requirement: Published weekly-report reads do not fetch stageAssignments

On a published report, `getWeeklyReport`'s `projects` query MUST NOT
include the `stageAssignments` relation, since the published read model is
built from the frozen snapshot and `projects` on that branch is used only
for the cross-group audit computation (`id` and `lead.reportingGroupId`).
The live (non-published) branch, which feeds `buildPortfolioOverview` from
the live project rows, MUST continue to include `stageAssignments`.

#### Scenario: Published branch fetches only the fields the audit signal needs

- **GIVEN** a request for a report whose `periodStatus` is `published`
- **WHEN** the repository queries `projects`
- **THEN** the query selects `id` and `lead.reportingGroupId` and does not
  include `stageAssignments`

#### Scenario: Live branch still fetches stageAssignments

- **GIVEN** a request for a report whose `periodStatus` is not `published`
- **WHEN** the repository queries `projects`
- **THEN** the query includes `stageAssignments`, as consumed by
  `buildPortfolioOverview`

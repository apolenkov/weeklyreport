## ADDED Requirements

### Requirement: Allowed-group-id derivation has a single shared implementation

The set of group ids a user is allowed to read MUST be computed by one exported
function reused by every consumer; the audit-signal path and the scope-filter
path MUST NOT each carry their own copy. The private `computeAllowedGroupIds`
used by the scope filter MUST be exported and called by the cross-group audit
signal in
`apps/api/src/modules/weekly-report/cross-group-signal.ts`, replacing its local
`getAllowedGroupIds`.

#### Scenario: audit signal and scope filter cannot diverge

- **GIVEN** the cross-group audit signal and the scope filter both need the
  allowed group ids for a user
- **WHEN** the allowed-group rule changes (e.g. a new hierarchy edge)
- **THEN** both paths observe the change because they call the same exported
  `computeAllowedGroupIds`
- **AND** no second `getAllowedGroupIds` implementation remains in
  `cross-group-signal.ts`

### Requirement: The active-leads-last-published-period query has one shared implementation

The active-leads-in-the-last-published-period query MUST be defined once and
reused by both telemetry consumers, not duplicated. The functionally identical
`activeLeadsLastPublishedPeriod` bodies in
`apps/api/src/modules/telemetry/telemetry.gauges.ts` and
`apps/api/src/modules/telemetry/telemetry.prisma-repository.ts` MUST collapse to
a single shared query so a change to how an "active lead" is counted lands in one
place. This query backs the active-leads KPI; it does NOT back the on-time ratio.

#### Scenario: the active-leads query is defined once

- **GIVEN** the Prom gauge and the dashboard summary card both need the count of
  active leads in the last published period
- **WHEN** a maintainer changes how an active lead is counted
- **THEN** there is one shared `activeLeadsLastPublishedPeriod` query that both
  call, so the change applies in a single place
- **AND** no second copy of the query body remains in either file

### Requirement: The two on-time-ratio windows are named distinctly

The two on-time submission ratios MUST carry distinct names because they are
computed over genuinely different windows and must not be mistaken for one
metric. The Prom gauge uses `onTimeRatioLastNPeriods` (a single ratio pooled
across the last N published periods) while the dashboard summary takes the
freshest entry of
`onTimeRatioPerPeriod` (the latest single period's ratio). Both live in
`apps/api/src/modules/telemetry`. The names MUST state their differing window;
the active-leads query above does NOT define this ratio.

#### Scenario: the pooled and latest-period ratios are not conflated

- **GIVEN** the pooled multi-period gauge ratio and the latest-period summary
  ratio measure different windows
- **WHEN** a maintainer reads the two on-time-ratio surfaces
- **THEN** each carries a name that states its window (pooled-N-period vs
  latest-period)
- **AND** neither is collapsed into the other nor described as backed by the
  active-leads query

### Requirement: The "report has content" predicate is a single shared helper

The 6-clause predicate that decides whether a weekly report has any content MUST
be one exported helper reused by every site, not re-implemented per call site.
The publish gate and the accordion-render checks in
`apps/web/src/components/weekly-report/weekly-report-page.tsx` (and the other
sites that currently inline the predicate) MUST import the shared
`reportHasContent` helper.

#### Scenario: publish gate and accordion render agree

- **GIVEN** a report whose content makes the predicate true at the boundary
- **WHEN** the publish gate and the accordion-render path both evaluate it
- **THEN** they call the same `reportHasContent` helper and reach the same result
- **AND** no inline copy of the predicate remains at any of the former sites

### Requirement: Worst-status severity is computed by one shared function

The traffic-light worst-status / severity roll-up MUST be computed by a single
`TrafficLightStatus`-typed `computeWorstStatus` (with its `statusSeverity`
map) imported by both the live and published paths; the loosely string-typed
duplicate MUST be removed. The canonical copy lives in
`apps/api/src/modules/published-report-snapshot.ts` and MUST be
imported by `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`.

#### Scenario: live and published roll-ups use one rule

- **GIVEN** a portfolio whose statuses determine a worst-status roll-up
- **WHEN** the live repository path and the published snapshot path both compute
  it
- **THEN** both call the single `TrafficLightStatus`-typed `computeWorstStatus`
- **AND** the string-typed `?? 0` duplicate in the repository is deleted, so a
  future severity-scale change is applied in one place

### Requirement: LeadKanbanItem declares the priorityRank it is given

The `LeadKanbanItem` type MUST declare every field its mapper assigns, so a
later "remove unused field" cleanup cannot strip a field the producer emits. The
`priorityRank` that `mapLeadItems` in `apps/web/src/lib/mappers/lead-form.ts`
emits MUST be present on the `LeadKanbanItem` interface.

#### Scenario: the mapper output matches the consumer type

- **GIVEN** `mapLeadItems` assigns `priorityRank` to each kanban item
- **WHEN** `pnpm typecheck` runs
- **THEN** `LeadKanbanItem` declares `priorityRank` and the assignment is typed,
  not silently widened or dropped

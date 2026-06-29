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

### Requirement: The on-time submission ratio has one canonical definition

The on-time submission ratio KPI MUST have a single canonical definition, and
the `activeLeadsLastPublishedPeriod` query backing it MUST be shared rather than
duplicated across repositories. Where the pooled multi-period gauge and the
latest-period card legitimately measure different windows, the two MUST be named
distinctly so they are not mistaken for the same metric. The consumers are
`apps/api/src/modules/telemetry/telemetry.gauges.ts` and
`apps/api/src/modules/telemetry/telemetry.prisma-repository.ts`.

#### Scenario: the active-leads query is defined once

- **GIVEN** the gauge and the card both need active leads in the last published
  period
- **WHEN** a maintainer reads the telemetry module
- **THEN** there is one `activeLeadsLastPublishedPeriod` query shared by both
- **AND** the two ratio surfaces either reuse one definition or carry distinct
  names that state their differing window

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

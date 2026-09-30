# analytics-query-correctness

## Purpose

Keep analytics query results and cache keys correct under lead scoping, republished periods, and nested cache-key inputs.

## Requirements

### Requirement: trafficLightHistory's lead filter scopes section aggregation

When `TrafficLightHistoryInput.leadId` is set, the query MUST restrict which
sections are aggregated into the output rows to that lead's own sections,
not only which reports qualify for inclusion.

#### Scenario: a leadId-filtered call returns only that lead's projects

- **WHEN** `trafficLightHistory` is called with `leadId` set to a specific
  lead who shares report periods with other in-scope leads
- **THEN** the returned `rows` contain only projects drawn from that lead's
  sections
- **AND** projects belonging solely to other in-scope leads' sections are
  absent from the result

### Requirement: Analytics uses one report in effect per period label

`trafficLightHistory`, `periodComparison`, and `leadVelocity` MUST use the
same report in effect for each UTC period label (`isoDateOnly(periodEnd)`).
Only reports satisfying `status: 'published'`, `periodStatus: 'published'`,
and `archived: false` are eligible. Among eligible reports admitted by the
caller's frozen group scope, the latest snapshot `publishedAt` wins; equal
publication times are resolved by latest `createdAt`, then lexicographically
greatest report `id`. The time component of `periodEnd` and database row
order MUST NOT change the winner within a period label.

The winning snapshot alone supplies project names, statuses, risks, and lead
activity for that label. Missing projects and null traffic-light values MUST
NOT fall back to an older report. An optional lead filter MUST be applied
after choosing the report in effect, so an omitted lead cannot resurrect an
older publication.
If a project occurs in multiple admitted sections of that snapshot, history
and comparison MUST use the worst non-null status across its occurrences
(`aggregateTrafficLight`, as the published report does), and null only when
every occurrence is null. Comparison's project name is the last occurrence.

#### Scenario: A later publication omits a project's status

- **GIVEN** an earlier eligible report contains a green project status
- **AND** the report in effect omits that project or has a null status
- **WHEN** history and comparison read that period
- **THEN** neither returns the older green status
- **AND** an explicitly null project keeps its name and null status

#### Scenario: An archived report has a later publication timestamp

- **GIVEN** a published non-archived report and a later archived report share a label
- **WHEN** any published-floor analytics query reads that label
- **THEN** only the non-archived report is eligible

#### Scenario: Publication and creation timestamps are equal

- **GIVEN** two eligible reports share a period label and publication and creation times
- **WHEN** analytics reads the reports in either database row order
- **THEN** the lexicographically greatest report id wins in every query

#### Scenario: A requested lead is absent from the report in effect

- **GIVEN** an earlier report contains a lead's section
- **AND** the report in effect omits that lead
- **WHEN** history is filtered to that lead
- **THEN** it returns no projects from the earlier report

#### Scenario: Two snapshot sections contain the same project

- **GIVEN** the report in effect contains the same project in two admitted sections
- **AND** the sections contain different statuses, including a possible null
- **WHEN** history and comparison read that period
- **THEN** both use the worst non-null status across the occurrences, regardless of section order
- **AND** a null occurrence never masks a non-null status; the result is null only when all are null

### Requirement: leadVelocity reports truthful submission counts by period label

`leadVelocity` MUST produce one row per eligible period label using its
report in effect. Each lead represented in the winning frozen snapshot MUST
appear once. `submittedSections` MUST be 1 when that lead's section status
is `submitted`, otherwise 0. Leads with non-submitted sections MUST remain
in the output; mutable live users MUST NOT supply historical membership.

#### Scenario: a republished period collapses into one row

- **WHEN** two eligible published reports share the same `periodEnd` calendar day
  (a republished period)
- **THEN** `leadVelocity`'s output contains exactly one row for that period
  label
- **AND** that row's `leads` array comes only from the report in effect

#### Scenario: A published snapshot contains an unsubmitted lead section

- **GIVEN** the report in effect contains one submitted and one draft lead section
- **WHEN** `leadVelocity` reads that period
- **THEN** both leads appear with `submittedSections` values of 1 and 0 respectively

#### Scenario: An older submission is replaced by a non-submitted section

- **GIVEN** an older report contains a submitted section for a lead
- **AND** the report in effect contains a draft section for that lead
- **WHEN** `leadVelocity` reads that period
- **THEN** that lead's `submittedSections` is 0

### Requirement: analytics cache keys hash nested objects correctly

The analytics service's cache-key hashing function MUST sort object keys at
every nesting level independently, not only at the top level, so that two
structurally-equivalent inputs (including nested objects) always produce the
same cache key, and two inputs differing at any depth always produce
different keys.

#### Scenario: a nested key survives hashing

- **WHEN** two cache-key inputs are deep-equal except that a nested object's
  key ordering differs
- **THEN** the two inputs hash to the same cache key

#### Scenario: a nested value difference changes the hash

- **WHEN** two cache-key inputs are identical except for a nested object
  key's value
- **THEN** the two inputs hash to different cache keys

### Requirement: Published-floor analytics queries exclude reopened periods

Published-floor analytics queries MUST require both companion `status:
'published'` and `periodStatus: 'published'`, plus `archived: false`. A publication-marked report whose
period is currently reopened MUST be absent from `trafficLightHistory`,
`leadVelocity`, and `periodComparison` until it is re-published.

#### Scenario: A reopened period is absent from analytics

- **GIVEN** a report with `status: 'published'` and `periodStatus: 'reopened'`
- **WHEN** any published-floor analytics query covers that report's period
- **THEN** the query returns no data derived from that report

#### Scenario: A re-published period reappears in analytics

- **GIVEN** the same report has been re-published and its `periodStatus` is
  `'published'` again
- **WHEN** any published-floor analytics query covers that report's period
- **THEN** the report's re-published sections are included normally

### Requirement: Settled analytics facts come only from the publication snapshot

`trafficLightHistory`, `leadVelocity`, and `periodComparison` MUST derive
published facts from the validated immutable
`publishedSnapshot`. They MUST NOT reconstruct statuses, risks, lead activity,
or group ownership from mutable `ReportSection`, `ProjectStatus`, `Risk`, or
`User` rows. DB-side admission MAY use `PublishedSectionScope`, but the returned
facts and final scope filter MUST come from the canonical snapshot parser and
its frozen section ownership. An absent, malformed, or report-mismatched
snapshot MUST fail closed.

#### Scenario: Recovery restores a publication without live sections

- **GIVEN** a settled report has a valid immutable snapshot and frozen scope projection
- **AND** its live section, status, and risk rows are absent after recovery
- **WHEN** an authorized caller requests published analytics
- **THEN** the result matches the metrics captured at publication time
- **AND** a caller from another group receives none of those facts

#### Scenario: Mutable ownership drifts after publication

- **GIVEN** a published snapshot freezes a section under group A
- **WHEN** the live author's current reporting group later changes
- **THEN** group A retains the published analytics visibility
- **AND** the mutable user row does not change historical metrics or scope

#### Scenario: A settled snapshot is malformed

- **GIVEN** a report satisfies the published lifecycle floor
- **AND** its persisted publication snapshot is malformed or mismatched
- **WHEN** analytics attempts to read the report
- **THEN** the read fails with a snapshot-integrity error instead of falling back to live rows

### Requirement: Every successful publish path invalidates the analytics cache

Every successful report-publish path, including `PeriodService.publishPeriod` and `PublicationService.publishAuto`, MUST invalidate `AnalyticsCache` after the publish commits. `emitPublishSideEffects` MUST require an analytics-cache invalidation dependency; a composition root or caller MUST NOT silently omit it. The next call to `AnalyticsService.trafficLightHistory`, `leadVelocity`, or `periodComparison` after publish MUST recompute against post-publish data rather than serve a cached pre-publish value.

#### Scenario: Automatic publish evicts a cached pre-publish analytics result

- **GIVEN** an analytics query has cached a result before a due report is published
- **WHEN** `PublicationService.publishAuto` successfully publishes that report
- **THEN** the matching analytics cache entries are invalidated
- **AND** the next analytics read recomputes and does not return the cached pre-publish result

#### Scenario: Manual publish evicts a cached pre-publish analytics result

- **GIVEN** an analytics query has cached a result before a report is published
- **WHEN** `PeriodService.publishPeriod` successfully publishes that report
- **THEN** the matching analytics cache entries are invalidated
- **AND** the next analytics read recomputes and does not return the cached pre-publish result

### Requirement: Analytics returns the winning frozen period range

The tRPC analytics procedures `trafficLightHistory`, `leadVelocity`, and
`periodComparison` MUST return readonly ISO UTC date pairs `periodStart` and
`periodEnd` from the same winning publication snapshot that supplies their
cells. History periods MUST be these pairs; submission rows MUST carry both
dates alongside leads. Comparison MUST return a pair for each populated side
and null for a missing side. Query inputs MUST retain date-only end labels.
Live report dates and current duration settings MUST NOT replace frozen dates.
Existing SQL admission, frozen ownership, published lifecycle floor, and winner
ordering by publication time, creation time, then report id MUST remain intact.
Old nonempty response shapes MUST fail cache validation and be recomputed.

#### Scenario: A manual range replaces an earlier publication

- **WHEN** two admitted snapshots share a frozen UTC end day and the winning snapshot has a different start
- **THEN** every analytics response uses the winner's two dates and values regardless of row order or non-midnight timestamps
- **AND** mutable report dates and current duration settings do not change the returned dates

#### Scenario: A cached response predates period metadata

- **WHEN** an analytics cache entry contains string history periods, submission labels alone, or comparison rows without period metadata
- **THEN** the entry is rejected and the repository recomputes a valid response

### Requirement: One comparison side represents one frozen period

The `periodComparison` repository MUST group validated SQL-admitted snapshots
for each comparison side by their frozen UTC end day. More than one group MUST
raise the existing publication snapshot integrity error. An empty side MUST
return null metadata and empty cells. Within one group, only the existing
winning snapshot MUST provide both the returned period pair and cells.

#### Scenario: Admitted rows disagree on the frozen end day

- **WHEN** either comparison side contains more than one frozen UTC end-day group
- **THEN** comparison fails with a snapshot integrity error in either row order

#### Scenario: A comparison side has no admitted publication

- **WHEN** one side has no snapshots
- **THEN** its metadata is null and its cells contain no status or risk facts

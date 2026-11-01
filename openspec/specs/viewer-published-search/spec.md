# viewer-published-search Specification

## Purpose

Define the viewer's published-scoped search: it returns only published content the
viewer can already open (matching report-read visibility) and routes every result
inside the viewer surface, never to the lead or admin surfaces.

## Requirements

### Requirement: Viewer search returns only published content the viewer can see

The system SHALL let a viewer search items, risks, and decisions within reports,
restricting results to **published** reports (`Report.periodStatus = 'published'`)
and to content the viewer can see through the section's **frozen publish-time
author-group ownership** materialized from the validated
`Report.publishedSnapshot` into `PublishedSearchDocument`.
Publication and admin recovery MUST replace that report's complete projection
inside the same database transaction that persists the snapshot. Published
search MUST query the generated `searchTsv` through its GIN index with the
caller's frozen group filter and requested limit; it MUST NOT load snapshots
into API memory or read live `ReportSection`, record, author, or group rows.
Therefore later edits, group moves, or an admin recovery with no live section
graph cannot change the searchable content or its scope. An absent projection
fails closed as no results. Unpublished or reopened content MUST never appear
in search, and a viewer with no group access MUST get an empty result set.
Product (`project`) hits MUST be excluded for the viewer in v1, because a product
has no publish state and its result destination is the admin surface the viewer
cannot reach.

Search visibility is **narrower than the viewer's report read**, by design: under
`viewer-live-status` the viewer reads the current period live with submitted
sections by default; Show all explicitly reveals authorized drafts,
but search stays **published-scoped**. A live submitted or draft record is therefore
**readable before it is searchable**. Search results MUST still route inside the viewer surface
(`/reports/[reportId]`), never to the lead or admin surfaces.

This runs under a dedicated `published` scope; it does not widen the head/admin
`all` scope. A viewer MUST be authorized for `published` only: explicit `mine`
or `all` requests MUST fail before any repository query, even when the viewer
has current group grants. The viewer History UI MUST submit `published`
explicitly rather than rely on the role-agnostic wire schema's `mine` default.

#### Scenario: Viewer searches within accessible, published content

- **GIVEN** a viewer with access to a group that has a published report
- **WHEN** the viewer queries a term matching a published item, risk, or decision
  the viewer can see
- **THEN** the matching published results are returned
- **AND** the search input is rendered on the viewer's `/reports` surface

#### Scenario: Viewer cannot enter live search through another scope

- **GIVEN** a viewer with one or more current group grants
- **WHEN** the viewer calls search with `scope = mine` or `scope = all`
- **THEN** the request is rejected as forbidden
- **AND** the search repository is not called

#### Scenario: A live record is readable but not yet searchable

- **GIVEN** a submitted or draft record in the current (non-published) period that
  the viewer can READ via the Status entry
- **WHEN** the viewer searches for a term matching it
- **THEN** the record is NOT returned by search (search is published-scoped)
- **AND** this read/search divergence is the accepted v1 behavior

#### Scenario: Published content authored outside the viewer's groups is excluded

- **GIVEN** a published item, risk, or decision whose frozen section group is
  outside the viewer's granted group(s)
- **WHEN** the viewer searches for a term matching it
- **THEN** the result is NOT returned
- **AND** search content stays bounded by the publish-time section group (even
  if the author's current group later changes)

#### Scenario: Published search survives recovery without live sections

- **GIVEN** a valid published snapshot has been restored with no corresponding
  live `ReportSection`, item, risk, or decision rows
- **WHEN** a viewer searches for content frozen in a section whose frozen group
  is granted to that viewer
- **THEN** the result returns the frozen record, report, and section identifiers
- **AND** its title and snippet are derived from the frozen record content
- **AND** restore reconstructed the indexed projection from the validated
  snapshot inside the restore transaction

#### Scenario: Live mutations cannot drift published search

- **GIVEN** an immutable published snapshot and a matching live section graph
- **WHEN** live records are edited or deleted, or the section author's current
  reporting group changes
- **THEN** published results, content, anchors, and scope remain unchanged

#### Scenario: Republish replaces the exact indexed corpus

- **GIVEN** a reopened report retains a prior publication projection
- **WHEN** a new publication wins its lifecycle compare-and-set
- **THEN** the old scope and search rows for that report are deleted and the new
  rows are inserted in the same transaction as the new snapshot
- **AND** no stale or duplicate document remains searchable

#### Scenario: Unpublished content is excluded

- **GIVEN** a report period that is not published (`periodStatus` is `open` or
  `reopened`)
- **WHEN** a viewer searches for a term that would match content in it
- **THEN** that content is NOT included in the viewer's results

#### Scenario: Product hits are excluded for the viewer

- **GIVEN** a query that matches a product (`project`) name
- **WHEN** a viewer runs the search
- **THEN** no `project`-type result is returned to the viewer

#### Scenario: Viewer with no group access

- **GIVEN** a viewer with no `ViewerGroupAccess` rows
- **WHEN** the viewer issues any search query
- **THEN** the result set is empty
- **AND** no content from other groups is revealed

#### Scenario: Result routing stays inside the viewer surface

- **GIVEN** a viewer search result for a published report, item, risk, or decision
- **WHEN** the viewer selects that result
- **THEN** navigation targets `/reports/[reportId]` for the published report that
  contains the match
- **AND** it never targets the lead (`/lead/report/...`) or admin (`/admin...`)
  surfaces

#### Scenario: Viewer search produces no cross-group access to audit

- **GIVEN** viewer search filters by frozen section group ownership and excludes
  `project` hits
- **WHEN** a viewer runs any search
- **THEN** it cannot surface a cross-group product read, so no `scopeAccessed`
  audit event is produced
- **AND** this is a no-op by construction, not an audit gap

### Requirement: Published search orders ties identically before the limit and in the response

Published search SHALL order matching documents by rank descending, then
`createdAt` descending, then record id ascending, and SHALL apply the result
limit after that order. Rows that share a record id SHALL be ordered by report
id and record type ascending so the order is deterministic. The returned list
SHALL be the first N rows of this order, not a re-sorted subset chosen by a
different order.

#### Scenario: A tie straddles the limit

- **GIVEN** a published report with three matching records of equal rank and
  creation time
- **WHEN** a search with limit 2 runs
- **THEN** the two records with the smallest ids are returned, in ascending id order

#### Scenario: The limit covers every tied record

- **GIVEN** the same three records
- **WHEN** a search with limit 3 runs
- **THEN** all three are returned in ascending id order

### Requirement: Shared SearchInput popup relationships resolve to mounted popups

Shared SearchInput MUST emit aria-controls only while its expanded popup is mounted, and that value MUST reference the existing popup ID. When the popup is unmounted, the relation MUST be omitted. The change MUST preserve existing popup identity, aria-expanded, scopes, result contents, debounce and navigation behavior.

#### Scenario: Search popup opens and closes

- **GIVEN** the shared SearchInput initially has no popup
- **WHEN** a valid query opens its popup and Escape later closes it
- **THEN** the expanded control references the mounted popup
- **AND** neither the initial nor escaped collapsed control has a dangling popup reference
- **AND** existing result selection and navigation behavior remain unchanged

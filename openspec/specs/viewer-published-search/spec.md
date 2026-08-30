# viewer-published-search Specification

## Purpose

Define the viewer's published-scoped search: it returns only published content the
viewer can already open (matching report-read visibility) and routes every result
inside the viewer surface, never to the lead or admin surfaces.

## Requirements

### Requirement: Viewer search returns only published content the viewer can see

The system SHALL let a viewer search reports, items, risks, and decisions,
restricting results to **published** reports (`Report.periodStatus = 'published'`)
and to content the viewer can see through the **section author-group access**
(the `author.reportingGroupId` join). Unpublished or reopened content MUST never
appear in search, and a viewer with no group access MUST get an empty result set.
Product (`project`) hits MUST be excluded for the viewer in v1, because a product
has no publish state and its result destination is the admin surface the viewer
cannot reach.

Search visibility is **narrower than the viewer's report read**, by design: under
`viewer-live-status` the viewer READS the current period live (drafts included),
but search stays **published-scoped**. A live submitted or draft record is therefore
**readable before it is searchable**. Search results MUST still route inside the viewer surface
(`/reports/[reportId]`), never to the lead or admin surfaces.

This runs under a dedicated `published` scope; it does not widen the head/admin
`all` scope.

#### Scenario: Viewer searches within accessible, published content

- **GIVEN** a viewer with access to a group that has a published report
- **WHEN** the viewer queries a term matching a published item, risk, or decision
  the viewer can see
- **THEN** the matching published results are returned
- **AND** the search input is rendered on the viewer's `/reports` surface

#### Scenario: A live record is readable but not yet searchable

- **GIVEN** a submitted or draft record in the current (non-published) period that
  the viewer can READ via the Status entry
- **WHEN** the viewer searches for a term matching it
- **THEN** the record is NOT returned by search (search is published-scoped)
- **AND** this read/search divergence is the accepted v1 behavior

#### Scenario: Published content authored outside the viewer's groups is excluded

- **GIVEN** a published item, risk, or decision whose section author is outside the
  viewer's granted group(s)
- **WHEN** the viewer searches for a term matching it
- **THEN** the result is NOT returned
- **AND** search content stays bounded by the section author-group access (even
  though the viewer's live READ may be broader)

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

- **GIVEN** viewer search filters by the section author-group and excludes
  `project` hits
- **WHEN** a viewer runs any search
- **THEN** it cannot surface a cross-group product read, so no `scopeAccessed`
  audit event is produced
- **AND** this is a no-op by construction, not an audit gap

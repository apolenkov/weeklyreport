## ADDED Requirements

### Requirement: Viewer search returns only published content the viewer can see

The system SHALL let a viewer search reports, items, risks, and decisions,
restricting results to **published** reports and to content the viewer can see
through the **same group-to-product access the viewer's report uses** (the
GroupProduct-based gate), not the legacy author `reportingGroupId` join. A result
MUST never reveal a product or section that the viewer's own report would hide.
Unpublished content MUST never appear, and a viewer with no group access MUST get
an empty result set. Product (`project`) hits MUST be excluded for the viewer in
v1, because a product has no publish state and its result destination is the admin
surface the viewer cannot reach.

This runs under a dedicated `published` scope; it does not widen the head/admin
`all` scope, and it replaces the prior behavior where a viewer had no search at all
(`all` forbidden, `mine` empty).

#### Scenario: Viewer searches within accessible, published content

- **GIVEN** a viewer with access to a group that has a published report
- **WHEN** the viewer queries a term matching a published item, risk, or decision
  the viewer can see
- **THEN** the matching published results are returned
- **AND** the search input is rendered on the viewer's `/reports` surface

#### Scenario: Result visibility matches the viewer's report

- **GIVEN** a product visible in search via one group join but hidden from the
  viewer's report via the GroupProduct gate
- **WHEN** the viewer searches for content under that product
- **THEN** the result is NOT returned
- **AND** search visibility equals the viewer's report visibility for every product

#### Scenario: Unpublished content is excluded

- **GIVEN** a report period that is not yet published
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

#### Scenario: Cross-group viewer search reads are audited

- **WHEN** a viewer search returns a hit from a group other than the viewer's home
  context
- **THEN** the read is recorded with `scopeAccessed`, consistent with the report
  read path

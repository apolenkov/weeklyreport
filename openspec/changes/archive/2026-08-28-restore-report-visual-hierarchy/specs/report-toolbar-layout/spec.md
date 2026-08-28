## ADDED Requirements

### Requirement: Report context controls preserve semantic clusters at every supported width

The lead, head, and viewer report context bars MUST keep controls that answer the same question in one visible cluster. Period navigation and its show-archived-periods filter MUST remain adjacent on desktop; view scope, mode, review, and trailing utility controls MUST remain a distinct trailing cluster. Responsive reflow MUST keep every control reachable without inserting unexplained empty space inside either cluster.

#### Scenario: archived periods exist on a wide lead report

- **WHEN** a lead opens a report with archived periods at a desktop width
- **THEN** the archive filter renders directly after the period navigator and its separator
- **AND** flexible space separates that complete period cluster from the trailing view controls

#### Scenario: context controls reflow at a compact width

- **WHEN** the same report context controls do not fit on one row
- **THEN** the clusters wrap without clipping any control or separating the archive filter from period navigation

### Requirement: Visual acceptance uses clean role and viewport evidence

Report UI changes MUST be accepted against clean browser screenshots for lead, head, admin, and viewer roles at desktop and compact widths. The evidence MUST include report edit and slides where the role supports them, MUST identify the tested source SHA, and MUST NOT classify browser inspector overlays or browser chrome as product rendering.

The capture runtime MUST suppress the Next.js on-screen development indicator and
application inspection tools while retaining compile and runtime error reporting.
The application navigation MUST expose exactly one stable product-owned accent
landmark for visual evidence.

#### Scenario: a suspected navigation stripe is reviewed

- **WHEN** a screenshot contains a line or highlight not reproduced in a clean browser capture at the same route and viewport
- **THEN** the highlight is recorded as capture tooling or browser state rather than fixed as application CSS

#### Scenario: a report layout change is accepted

- **WHEN** a change affects shared report chrome or slide presentation
- **THEN** the review set contains source-bound screenshots for every affected role, mode, and required viewport before the change is accepted

#### Scenario: development capture distinguishes product chrome from tooling

- **WHEN** the source-bound capture runs against a development server
- **THEN** the Next.js development indicator and application inspection tools are absent
- **AND** exactly one application-owned navigation accent landmark remains visible
- **AND** compile and runtime errors remain enabled

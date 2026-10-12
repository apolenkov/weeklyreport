# report-routing Specification

## Purpose

Define the URL shape invariant for lead and head report views. Ensures that
every report page carries a stable, bookmarkable path-segment identifier so
that links, deep-links, and browser history resolve to the correct report.

Consumer surfaces: Next.js routes
`apps/web/src/app/(app)/lead/report/[reportId]/page.tsx` and
`apps/web/src/app/(app)/head/report/[reportId]/page.tsx`.

## Requirements

### Requirement: Report URLs Encode the Report Identifier as a Path Segment

Lead and head report routes MUST encode a stable UUID identifier in the URL
as a path segment: `/lead/report/[reportId]` and `/head/report/[reportId]`
respectively. Query-parameter encoding (e.g. `?reportId=<uuid>`) MUST NOT
be used. The identifier MUST uniquely resolve to a single report period and
MUST remain stable for the lifetime of that report.

#### Scenario: Lead opens a report and the URL reflects the identifier

- **WHEN** a lead clicks into a report from the sidebar or dashboard
- **THEN** the browser URL contains the report's stable identifier
- **AND** copying the URL and pasting it in a new tab opens the same report

#### Scenario: Lead has two reports open in two browser tabs

- **WHEN** a lead has report A open in tab 1 and report B open in tab 2
- **THEN** each tab's URL contains a distinct identifier
- **AND** the user can distinguish the two reports by URL alone

### Requirement: Report Page Title and Breadcrumb Reflect the Report

The page title (`<title>` element) and the in-app breadcrumb MUST
include identifying metadata for the currently-loaded report (e.g.,
"Week of YYYY-MM-DD — WeeklyReport"). The metadata MUST update when
the route's identifier changes.

#### Scenario: Lead navigates from report A to report B

- **WHEN** a lead is on report A and clicks a navigation link to report B
- **THEN** the browser tab title updates to reflect report B's period
- **AND** the breadcrumb reflects report B's period

#### Scenario: Lead bookmarks a report URL

- **WHEN** a lead bookmarks the URL of a specific report
- **THEN** opening the bookmark loads that exact report
- **AND** the page title and breadcrumb match what was originally shown

### Requirement: The authorId deep-link scroll target matches the highlighted panel

The weekly-report page MUST resolve the `?authorId=<id>` deep-link scroll
target to the same product as the highlighted/expanded accordion panel.
Both MUST apply the same content filter — the scroll target MUST NOT be
derived from the author's raw first authored product without that filter,
since a filtered-out first product produces a scroll target that no visible
accordion panel satisfies. The delayed deep-link scroll MUST use smooth
behavior by default and switch to immediate `auto` behavior when the browser
reports `prefers-reduced-motion: reduce`.

#### Scenario: First authored product is empty, a later one has content

- **GIVEN** an `?authorId=<id>` deep-link where the author's first authored
  product has no content and a later authored product does
- **WHEN** the weekly-report page renders
- **THEN** the page scrolls into view the SAME product panel that is
  highlighted/expanded — the content-bearing one, not the empty first one

#### Scenario: Reduced motion keeps the author deep-link deterministic

- **GIVEN** an `?authorId=<id>` deep-link resolves to a visible product panel
- **WHEN** the browser reports `prefers-reduced-motion: reduce`
- **THEN** the page scrolls that panel into view with immediate `auto` behavior
- **AND** the same navigation uses smooth behavior when reduced motion is not
  requested

### Requirement: Activity-only draft sections count toward the draft-hidden signal

The weekly-report page's draft-hidden count and "Show all" affordance MUST
include sections whose only draft content is activity content (no draft
product content), under the default submitted-only filter. A section with
draft activity content but no draft product content MUST NOT be silently
excluded from the count just because the underlying product-content mapper
does not see it.

#### Scenario: A draft section has only activity content

- **GIVEN** a report section that is in draft state, with activity content
  but no product content
- **WHEN** the weekly-report page renders under the default submitted-only
  filter
- **THEN** the section counts toward the draft-hidden signal
- **AND** the "N in draft — Show all" affordance appears and, when
  activated, reveals that section

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

Ordinary weekly-report `?authorId=<id>` deep-links MUST resolve the scroll target to the same visible product as the highlighted/expanded accordion panel using the same content filter. Head Review links in Leads scope and Product review-roster navigation MUST instead scroll and focus the owning rendered author section, suppressing the Product-scroll request. Both mechanisms MUST use smooth scrolling by default and immediate `auto` scrolling when `prefers-reduced-motion: reduce` is reported.

#### Scenario: First authored product is empty, a later one has content

- **GIVEN** an ordinary author deep-link whose first authored product has no content and a later authored product does
- **WHEN** the weekly-report page renders
- **THEN** the content-bearing highlighted/expanded product receives the scroll request, not the empty first one

#### Scenario: Reduced motion keeps the author deep-link deterministic

- **WHEN** an ordinary author deep-link resolves to a visible product panel
- **THEN** the panel scrolls with `auto` under reduced motion and `smooth` otherwise

#### Scenario: Review targets the section rather than a competing Product panel

- **WHEN** an eligible targeted Head Review link or Product review-roster link opens Leads scope
- **THEN** the owning author region receives focus and the sole delayed scroll request
- **AND** no Product panel competes for scroll, including when the author has both Product and Activity content

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

### Requirement: Author targets belong to displayed scope-specific products

Ordinary author deep-links MUST select a Product from the displayed Product collection or the focused author's displayed Leads group. Highlight and delayed Product scroll MUST use that same rendered instance. Head Review/roster navigation in Leads scope MUST target the visible author region instead; an Activity-only or empty submitted reviewable section is valid without a Product anchor. Hidden or absent author content MUST NOT fabricate a Product or section target. Explicit overview navigation and full report summaries remain unchanged.

#### Scenario: Draft content is hidden by the submission filter

- **GIVEN** an author's only content is draft
- **WHEN** the Submitted body renders in either scope
- **THEN** no hidden draft Product or author region is selected
- **AND** Show all restores visible-content eligibility without granting Review capability

#### Scenario: A co-owner contributes only to a different product

- **GIVEN** Alice contributes to shared Alpha and Bob contributes only to Beta
- **WHEN** an ordinary Bob author link opens Leads scope
- **THEN** Bob's Beta instance is expanded and receives the Product-scroll request, with no nonexistent Bob Alpha target
- **AND** Product scope may select visible aggregate Alpha

#### Scenario: Activity-only Review has no fabricated Product anchor

- **WHEN** eligible Head Review targets an Activity-only author in Leads scope
- **THEN** the rendered author region receives focus without any Product target

### Requirement: Head review deep-links declare intent without granting capability

The `/head/report/[reportId]` form MUST recognize only the single scalar `review=1` as Review intent, separate from the Form/Slides `mode` parameter. With an author target it MUST activate Review only after that target is confirmed submitted and reviewable in the editable, non-archived report; without an author, at least one eligible section is required. Missing, invalid or repeated review values MUST resolve to Read.

#### Scenario: Queue Review enters the selected author's review

- **WHEN** Head follows `/head/report/[reportId]?authorId=[leadId]&scope=lead&review=1` for an eligible submitted author
- **THEN** the form opens Review with Submitted filtering, focuses that author's rendered section and exposes its verdict and record review controls
- **AND** an Activity-only section is a valid author target without a fabricated Product target
- **AND** opening or refreshing the link sends no review mutation

#### Scenario: Review intent is stale or unauthorized

- **WHEN** a review link targets a draft, absent or unauthorized author, or a published or archived report
- **THEN** the form remains Read without revealing hidden drafts or granting review controls
- **AND** it shows `Review is unavailable for this section.` for an author target or `Review is unavailable for this report.` without one
- **AND** no alternative author's eligibility silently authorizes the targeted section

#### Scenario: Plain Open and malformed intent retain defaults

- **WHEN** Head follows a link without review intent, with `review=0`, with an unknown value, or with repeated review keys
- **THEN** the form starts Read with its existing submission-filter default
- **AND** a draft author remains hidden until the explicit Show all action

### Requirement: Review URL state follows deliberate navigation

On `/head/report/[reportId]`, selecting Read MUST remove `review` and selecting eligible Review MUST set `review=1`. Refresh and browser history MUST restore that URL-selected mode subject to current gates. Same-report scope/archive-filter and Report/Slides navigation MUST preserve valid review intent and author context; selecting another period MUST clear review intent. Slides MUST NOT mount review mutation controls.

#### Scenario: Head explicitly returns to Read

- **WHEN** Head switches Review to Read and then refreshes or navigates back and forward
- **THEN** the mode follows each history entry's review intent without a stale local initializer overriding it
- **AND** an unrelated query update cannot re-enable Review after Read removed the intent

#### Scenario: Head changes view or period

- **WHEN** Head switches Report to Slides and back for the same report
- **THEN** eligible review intent and author context survive without review controls in Slides
- **WHEN** Head selects another period
- **THEN** the new period starts Read with no inherited review intent

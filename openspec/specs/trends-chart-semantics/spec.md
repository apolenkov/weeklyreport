# trends-chart-semantics Specification

## Purpose

Trends presents status history, lead submissions and period comparison as accessible, keyboard-scrollable tables with product status badges and full period dates.

## Requirements

### Requirement: Trends history and lead submissions are readable tables

Traffic-light history and Lead submissions SHALL render as visible HTML tables
(rows: projects or leads; columns: period end dates) with a `<caption>`,
`scope="col"`/`scope="row"` headers, no legend and no per-series colours.
Captions SHALL remain available to assistive technology without repeating the
visible section heading. Status cells SHALL reuse the product status badge
(label plus tone) without wrapping their words. Traffic-light history rows
SHALL be ordered by the latest displayed period's status using shared canonical
severity (Red, Yellow, Green, then No status), then by project name. A null or
absent latest-period status SHALL remain No status for ordering; earlier
statuses SHALL NOT override it. The table wrapper SHALL scroll
horizontally, be keyboard-focusable and be named by its section heading, with
the same visible focus indicator across all three tables. The first name
column SHALL remain visible while scrolling, with an opaque background. The
document width SHALL NOT grow.

#### Scenario: A keyboard user reads a table

- **WHEN** the user tabs to a populated section
- **THEN** focus lands on the table region named by the section heading
- **AND** every cell exposes its status word or submission state as text
- **AND** decorative arrows and check marks are excluded from its accessible text

#### Scenario: Narrow viewport

- **WHEN** Trends renders at 375 CSS pixels
- **THEN** the page has no horizontal overflow and the table scrolls inside its wrapper
- **AND** project or lead names remain visible while the periods scroll

#### Scenario: History rows use latest status severity and name

- **GIVEN** projects have Red, Yellow, Green, or missing statuses in the latest displayed period
- **WHEN** Traffic-light history renders
- **THEN** rows follow Red, Yellow, Green, then No status order, with project names breaking equal-status ties
- **AND** an earlier Red or Yellow does not promote a row whose latest status is Green or No status
- **AND** a null or absent latest status stays in the No status group even when an earlier status was reported

### Requirement: History highlights the latest reported period

Above Traffic-light history, a wrapping summary SHALL identify the latest
period end date and count projects by status using the existing product badges.
It SHALL omit zero groups and include nonzero No status counts. The latest
period column header and cells SHALL use an existing subtle muted surface.
Only that column SHALL show a muted Recovered or Slipped marker when a known
status improves or worsens against the preceding displayed period. Severity
SHALL use the shared canonical status order. Equal statuses, a single period,
or an unknown endpoint SHALL NOT produce a change marker. Marker words SHALL
be accessible text and their arrows SHALL be decorative.

#### Scenario: A reader checks the latest week

- **WHEN** the latest period has projects with reported or missing statuses
- **THEN** the summary uses only that period's status counts and includes every project
- **AND** the latest column has a subtle surface highlight

#### Scenario: A known status changes

- **WHEN** a project's preceding and latest statuses are both known
- **THEN** a lower severity shows Recovered and a higher severity shows Slipped beside the latest badge
- **AND** an unchanged severity has no marker

#### Scenario: A status cannot be compared

- **WHEN** there is no preceding period or either status is missing
- **THEN** the latest cell retains its badge without a change marker

### Requirement: Lead submissions present submission state honestly

The Lead submissions table SHALL display Submitted when the existing API
submittedSections value is positive and muted Missing when it is zero or
absent for that lead. It SHALL retain separate rows for distinct lead IDs even
when display names match. This presentation SHALL NOT describe the value as
velocity or throughput and SHALL NOT change the analytics API query or data.

#### Scenario: A lead has or has not submitted

- **WHEN** a period returns a positive submittedSections count for one lead and no submission for another
- **THEN** their cells show Submitted and Missing respectively
- **AND** the heading and hidden caption identify Lead submissions

### Requirement: Period comparison identifies its two periods

The comparison table SHALL visibly identify the previous and latest period end dates from the same pair used for its query in a paragraph above the scroll wrapper. It SHALL retain a hidden caption, label status and risk columns by that direction and explain that risk change is latest minus previous. Its status cells SHALL use the product status badge without wrapping. Its wrapper SHALL use the same keyboard-focusable named region and visible focus indicator as the other tables, and its project column SHALL stay visible while scrolling.

#### Scenario: The compared pair changes

- **WHEN** the query uses a different previous and latest period pair
- **THEN** the table displays those exact dates beside the corresponding comparison values
- **AND** no unexplained A or B column remains
- **AND** status cells use the product status badge
- **AND** the explanatory date sentence remains outside horizontal scrolling

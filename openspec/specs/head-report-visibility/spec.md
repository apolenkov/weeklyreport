# head-report-visibility Specification

## Purpose

Let heads reach live draft content before submission in the edit/dashboard
surface while defaulting it to submitted work and retaining submission as the
gate for publish and rollback actions.

## Requirements

### Requirement: The head can reveal live draft content regardless of submission

The head edit/dashboard surface for a live current period MUST default to submitted-only,
but every authorized draft section MUST remain reachable through the explicit
draft-hidden signal and `Show all` action. Submission status MUST NOT remove a
draft from the head's authorized read model. The no-content empty state MUST
render only when the report has no section content at all, not merely when the
submitted count is zero. Its copy MUST distinguish absent content from absent
submissions and MUST NOT claim no submissions when a submitted section exists.
Slide mode is outside this presentation requirement.

#### Scenario: a draft risk shares a product with a submitted section

- **GIVEN** one draft risk and one submitted contribution target the same product
- **WHEN** the head views the submitted-only Sections body
- **THEN** the draft risk is absent as both a record and a derived signal
- **AND** genuine submitted blocked, unresolved-risk, and red-product signals
  remain eligible
- **AND** the Portfolio Overview still reflects the full authorized report
- **AND** activating `Show all` renders the draft risk exactly once

#### Scenario: a submitted risk floors its product to red

- **GIVEN** a submitted section owns a product whose stored status is green
- **AND** a blocked risk covers one of that section's owned product stages
- **WHEN** the head views the submitted-only Sections body
- **THEN** the canonical submitted projection retains the effective-red product
  signal alongside the product-parented risk signals

#### Scenario: the full-report red representative belongs to a draft co-owner

- **GIVEN** a draft section and a submitted section co-own the same red product
- **AND** full-report deduplication attributed the red signal to the draft lead
- **WHEN** the head views the submitted-only Sections body in Product or Leads
  scope
- **THEN** the red signal is re-derived from the submitted section and remains
  eligible

#### Scenario: a draft co-owner has worse health than a submitted co-owner

- **GIVEN** a draft red contribution and a submitted green contribution target
  the same product
- **WHEN** the head views the submitted-only Sections body in Product scope
- **THEN** the Product header is on track and names only the submitted lead
- **AND** the Portfolio Overview remains blocked and retains both leads

#### Scenario: head opens a report with drafts and zero submissions

- **WHEN** the head opens a live report where leads have draft content but no
  section is yet submitted (`Live · 0/N Submitted`)
- **THEN** the default submitted-only view shows a draft-hidden signal rather than
  the empty state
- **AND** activating `Show all` reveals the current draft content of each section
- **AND** the no-content empty state is not shown

#### Scenario: head opens a report with no content at all

- **WHEN** the head opens a live report where no section has any content
- **THEN** the empty state identifies that there is no report content

#### Scenario: an empty submitted section remains a submission

- **WHEN** a live report has one submitted section and no section content
- **THEN** its empty state says that submitted sections contain no report content
- **AND** the header retains the submitted count and Publish remains enabled
- **AND** no message claims that leads have not submitted their sections

### Requirement: Submission gates publish and rollback, not authorization to access drafts

Section submission MUST gate only the publish precondition and the
review/rollback affordance, never authorization to access drafts. The default
submitted-only presentation MAY hide drafts until `Show all`. The `Publish & lock` action MUST
stay disabled until at least one section is submitted, and its disabled label
(`Nothing to publish`) MUST reflect that publish precondition - NOT the absence
of on-screen content. The `Live - X/Y Submitted` badge MUST continue to report
the submitted count. In the consolidated report, per-section verdict controls
MUST be present only for submitted sections carrying review capability, and the
Read/Review mode toggle MUST be present only when at least one such section
exists. A review capability on a draft section MUST NOT expose verdict actions.

#### Scenario: drafts reachable but publish still gated

- **WHEN** the head views a live report with draft content and zero
  submitted sections
- **THEN** the draft-hidden signal is visible and `Show all` reveals the draft content
- **AND** `Publish & lock` is disabled with the `Nothing to publish` label
- **AND** the `Live - 0/N Submitted` badge still shows the submitted count

#### Scenario: one section submitted enables publish

- **WHEN** at least one section is submitted
- **THEN** `Publish & lock` becomes available
- **AND** the head can review and roll back (reopen) submitted sections

#### Scenario: draft reviewer capability does not expose verdict actions

- **WHEN** a consolidated report contains a draft section whose server-provided `canReview` capability is true and no submitted reviewable section
- **THEN** the draft content remains reachable through `Show all`
- **AND** the Read/Review mode toggle is absent
- **AND** `Approve` and `Request changes` are not presented for that draft section

#### Scenario: mixed draft and submitted sections keep only submitted verdict controls

- **WHEN** a consolidated report contains both draft and submitted sections with review capability
- **THEN** the Read/Review mode toggle is available
- **AND** verdict controls are rendered only for the submitted sections
- **AND** draft content remains reachable through `Show all` without verdict controls

### Requirement: Consolidated report labels reflect its lifecycle

The report header MUST display Archived when the report is archived, Published
when its period status is published and it is not archived, and Live otherwise.
The submission ratio MUST remain visible for each lifecycle. Label selection
MUST NOT change report lifecycle or publish eligibility.

#### Scenario: Published report is not labeled Live

- **WHEN** the report is published and not archived
- **THEN** the header shows Published alongside its submission ratio

#### Scenario: Archived label takes precedence

- **WHEN** the report is archived, including a previously published report
- **THEN** the header shows Archived alongside its submission ratio

### Requirement: Head period history projects only a matching live report envelope

The head report's `PeriodNavigator` history MUST use live period dates,
archive status and lifecycle state only when the live payload's `reportId`
matches the history entry's report identity. A displayed route resolving to
another report MUST NOT overwrite that entry's frozen envelope. The Current
marker MUST identify the actual active report, independently of the displayed
route.

#### Scenario: A reopened report updates its own frozen history envelope

- **GIVEN** a compiled history entry for a previously published report
- **AND** the matching live report was reopened and its period dates changed
- **WHEN** the head's period history is derived
- **THEN** that report uses its live dates, archive flag and open lifecycle
- **AND** its Current marker follows the actual active report identity

#### Scenario: A displayed route returns a different report

- **GIVEN** history contains report A with frozen period dates
- **AND** the displayed route addresses A but its payload describes report B
- **WHEN** the head's period history is derived
- **THEN** A retains its frozen dates and archive status
- **AND** A's lifecycle comes from its own archived or reopened history state
- **AND** B's live envelope is not projected onto A

#### Scenario: A scheduled displayed report does not steal the Current marker

- **GIVEN** an open active report and a different displayed scheduled report
- **WHEN** the head's period history is derived
- **THEN** only the actual active report is marked Current
- **AND** the displayed scheduled report retains its scheduled lifecycle

### Requirement: Accessible draft-hidden signal in report review

The draft-hidden signal MUST keep a polite live region (`role="status"`, `aria-live="polite"`) mounted while the section filter is shown in review, and MUST render only its notice text conditionally inside that region, so that a draft-hidden notice arriving after a filter switch is announced. The `Show all` action MUST stay outside the live region and MUST expose contextual naming (`aria-label="Show all sections including drafts"`).

#### Scenario: head opens a report with drafts and zero submissions

- **WHEN** the head opens a live report where leads have draft content but no section is yet submitted (`Live · 0/N Submitted`)
- **THEN** the live region is already in the DOM before the filter is switched, and it gains the draft-hidden notice text when the default submitted-only view hides drafts
- **AND** the no-content empty state is not shown
- **AND** activating `Show all` reveals the current draft content of each section

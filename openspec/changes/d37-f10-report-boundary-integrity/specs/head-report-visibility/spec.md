## MODIFIED Requirements

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

#### Scenario: A red-only draft co-owner is not the global representative

- **GIVEN** submitted and draft sections co-own a red product and the draft has no record content
- **WHEN** the submitted section is the full-report red representative and the head views Leads
- **THEN** the draft-hidden signal includes that draft section
- **AND** Show all reveals its own expandable product panel without copying the other author's attention text
- **AND** the same panel delivery holds when representative order is reversed
- **AND** the full report retains exactly one global product-red callout

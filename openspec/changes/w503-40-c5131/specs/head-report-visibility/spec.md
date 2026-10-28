# Spec Delta: head-report-visibility

## MODIFIED Requirements

### Requirement: The head can reveal live draft content regardless of submission

The head edit/dashboard surface for a live current period MUST default to submitted-only,
but every authorized draft section MUST remain reachable through the explicit
draft-hidden signal and `Show all` action. The draft-hidden signal MUST be accessible to
assistive technologies via a polite live region (`role="status"`, `aria-live="polite"`),
and its `Show all` action MUST expose contextual naming (`aria-label="Show all sections including drafts"`)
so users of assistive technologies understand what content will become visible.
Submission status MUST NOT remove a draft from the head's authorized read model. The no-content empty state MUST
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
- **AND** the draft-hidden signal has `role="status"` and `aria-live="polite"`
- **AND** the `Show all` button provides assistive-technology context via `aria-label="Show all sections including drafts"`
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

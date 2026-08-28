# head-report-visibility Specification

## Purpose

Let heads see live draft content before submission while retaining submission as the gate for publish and rollback actions rather than visibility.

## Requirements

### Requirement: The head sees live draft content regardless of submission

The head MUST see the current content of every lead's report section in the live
(non-published) report, whether the section is `draft` or `submitted`.
Submission status MUST NOT gate what the head can see. The "No submissions yet"
empty state MUST render only when the report has no section content at all — NOT
merely when the submitted count is zero. This applies equally to the head's slide
mode and the head's edit/dashboard mode (both render the same report view).

#### Scenario: head opens a report with drafts and zero submissions

- **WHEN** the head opens a live report where leads have draft content but no
  section is yet submitted (`Live · 0/N Submitted`)
- **THEN** the head sees the current draft content of each section
- **AND** the "No submissions yet" empty state is NOT shown

#### Scenario: head opens a report with no content at all

- **WHEN** the head opens a live report where no section has any content
- **THEN** the empty state renders (there is genuinely nothing to show)

### Requirement: Submission gates publish and rollback, not visibility

Section submission MUST gate only the publish precondition and the
review/rollback affordance, never visibility. The `Publish & Lock` action MUST
stay disabled until at least one section is submitted, and its disabled label
(`Nothing to publish`) MUST reflect that publish precondition - NOT the absence
of on-screen content. The `Live - X/Y Submitted` badge MUST continue to report
the submitted count. In the consolidated report, per-section verdict controls
MUST be present only for submitted sections carrying review capability, and the
Read/Review mode toggle MUST be present only when at least one such section
exists. A review capability on a draft section MUST NOT expose verdict actions.

#### Scenario: drafts visible but publish still gated

- **WHEN** the head views a live report with visible draft content and zero
  submitted sections
- **THEN** the draft content is visible
- **AND** `Publish & Lock` is disabled with the `Nothing to publish` label
- **AND** the `Live - 0/N Submitted` badge still shows the submitted count

#### Scenario: one section submitted enables publish

- **WHEN** at least one section is submitted
- **THEN** `Publish & Lock` becomes available
- **AND** the head can review and roll back (reopen) submitted sections

#### Scenario: draft reviewer capability does not expose verdict actions

- **WHEN** a consolidated report contains a draft section whose server-provided `canReview` capability is true and no submitted reviewable section
- **THEN** the draft content remains visible
- **AND** the Read/Review mode toggle is absent
- **AND** `Approve` and `Request changes` are not presented for that draft section

#### Scenario: mixed draft and submitted sections keep only submitted verdict controls

- **WHEN** a consolidated report contains both draft and submitted sections with review capability
- **THEN** the Read/Review mode toggle is available
- **AND** verdict controls are rendered only for the submitted sections
- **AND** draft content remains visible without verdict controls

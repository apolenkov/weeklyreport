## ADDED Requirements

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
("Nothing to publish") MUST reflect that publish precondition — NOT the absence
of on-screen content. The `Live · X/Y Submitted` badge MUST continue to report
the submitted count.

#### Scenario: drafts visible but publish still gated

- **WHEN** the head views a live report with visible draft content and zero
  submitted sections
- **THEN** the draft content is visible
- **AND** `Publish & Lock` is disabled with the "Nothing to publish" label
- **AND** the `Live · 0/N Submitted` badge still shows the submitted count

#### Scenario: one section submitted enables publish

- **WHEN** at least one section is submitted
- **THEN** `Publish & Lock` becomes available
- **AND** the head can review and roll back (reopen) submitted sections

### Requirement: Viewer visibility stays published-only

The viewer MUST continue to see a report only when its period is published; the
draft-visibility change MUST NOT widen viewer access. The server-side
published-only gate for the viewer role stays in force.

#### Scenario: viewer opens an unpublished report

- **WHEN** a viewer requests a report whose period is not published
- **THEN** the request is rejected (treated as not found), exactly as before this
  change

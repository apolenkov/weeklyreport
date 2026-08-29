## RENAMED Requirements

- FROM: `### Requirement: The head sees live draft content regardless of submission`
- TO: `### Requirement: The head can reveal live draft content regardless of submission`
- FROM: `### Requirement: Submission gates publish and rollback, not visibility`
- TO: `### Requirement: Submission gates publish and rollback, not authorization to access drafts`

## MODIFIED Requirements

### Requirement: The head can reveal live draft content regardless of submission

The head edit/dashboard surface for a live current period MUST default to submitted-only,
but every authorized draft section MUST remain reachable through the explicit
draft-hidden signal and `Show all` action. Submission status MUST NOT remove a
draft from the head's authorized read model. The "No submissions yet" empty state
MUST render only when the report has no section content at all — NOT merely when
the submitted count is zero. Slide mode is outside this presentation requirement.

#### Scenario: head opens a report with drafts and zero submissions

- **WHEN** the head opens a live report where leads have draft content but no
  section is yet submitted (`Live · 0/N Submitted`)
- **THEN** the default submitted-only view shows a draft-hidden signal rather than
  the empty state
- **AND** activating `Show all` reveals the current draft content of each section
- **AND** the "No submissions yet" empty state is NOT shown

#### Scenario: head opens a report with no content at all

- **WHEN** the head opens a live report where no section has any content
- **THEN** the empty state renders (there is genuinely nothing to show)

### Requirement: Submission gates publish and rollback, not authorization to access drafts

Section submission MUST gate only the publish precondition and the
review/rollback affordance, never authorization to access drafts. The default
submitted-only presentation MAY hide drafts until `Show all`. The `Publish & Lock`
action MUST stay disabled until at least one section is submitted, and its disabled
label (`Nothing to publish`) MUST reflect that publish precondition - NOT the
absence of on-screen content. The `Live - X/Y Submitted` badge MUST continue to
report the submitted count. In the consolidated report, per-section verdict
controls MUST be present only for submitted sections carrying review capability,
and the Read/Review mode toggle MUST be present only when at least one such section
exists. A review capability on a draft section MUST NOT expose verdict actions.

#### Scenario: drafts reachable but publish still gated

- **WHEN** the head views a live report with draft content and zero
  submitted sections
- **THEN** the draft-hidden signal is visible and `Show all` reveals the draft content
- **AND** `Publish & Lock` is disabled with the `Nothing to publish` label
- **AND** the `Live - 0/N Submitted` badge still shows the submitted count

#### Scenario: one section submitted enables publish

- **WHEN** at least one section is submitted
- **THEN** `Publish & Lock` becomes available
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

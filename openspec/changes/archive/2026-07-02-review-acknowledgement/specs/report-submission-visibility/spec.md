## ADDED Requirements

### Requirement: Head and Viewer Default to a Submitted-Only View of the Live Current Period

On the live current period the head and viewer SHALL default to seeing only
`submitted` sections, and MUST offer a per-user toggle that switches the view to
all sections including unsubmitted drafts.

The toggle is a view filter on the submitted/all axis — analogous to the lead's
`Record visibility` Mine/Everyone toggle but a different axis — and its state is
per-user. The default is `submitted-only`. The toggle MUST NOT change which periods
or groups are authorized (the read gate is unchanged); it filters only which
sections render within an already-authorized period.

#### Scenario: Default shows only submitted sections

- **GIVEN** a head or viewer on the live current period with one submitted and one
  draft section
- **WHEN** the report renders with the default view
- **THEN** only the submitted section's content is shown

#### Scenario: Toggle reveals draft sections

- **GIVEN** the same period in the default submitted-only view
- **WHEN** the head or viewer switches the toggle to "all"
- **THEN** the draft section's content is also shown

#### Scenario: The toggle does not widen authorization

- **GIVEN** a viewer with access to group A only, viewing with the "all" toggle
- **WHEN** the report renders
- **THEN** only group-A sections are shown (the group scope is unchanged)
- **AND** no other group's drafts are revealed

### Requirement: The Submitted-Only Default Never Makes Content Unreachable or Misleads

The submitted-only default SHALL NOT make draft content unreachable and MUST NOT
render a misleading "nothing here" state when draft content exists but is filtered
out; the presence of hidden draft sections MUST be signalled.

Draft content stays one toggle away. When the current period has draft content but
zero submitted sections, the default view MUST signal that hidden drafts exist (for
example "N sections in draft — show all") rather than the genuine "No submissions
yet" empty state, which MUST render only when the period has no section content at
all. This preserves the head's anti-empty-state guarantee while honoring the
submitted-only default.

#### Scenario: All-draft period signals hidden content, not an empty state

- **GIVEN** a head on a live current period where every section is draft with
  content and none is submitted
- **WHEN** the report renders in the default submitted-only view
- **THEN** the genuine "No submissions yet" empty state is NOT shown
- **AND** the presence of hidden draft sections is signalled with a way to show all

#### Scenario: Truly empty period still shows the empty state

- **GIVEN** a live current period where no section has any content
- **WHEN** the report renders in the default view
- **THEN** the "No submissions yet" empty state renders (there is nothing to show)

### Requirement: The Submission-State Toggle Applies Only to the Live Current Period

The submitted/all toggle SHALL apply only to the live current period; a published
report's snapshot MUST render as-is, unfiltered by submission state.

The published snapshot froze whatever content existed at publish time; filtering it
by submission state would require reconciling the frozen snapshot and is out of
scope (ADR 0010). The toggle MUST NOT be offered, or MUST be inert, on a published
report.

#### Scenario: Published snapshot is not filtered by the toggle

- **GIVEN** a head or viewer opening a past `published` report
- **WHEN** the report renders
- **THEN** the published snapshot is shown as-is
- **AND** the submitted/all toggle does not filter its content

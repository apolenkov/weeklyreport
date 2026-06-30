## MODIFIED Requirements

### Requirement: The head sees live draft content regardless of submission

The head MUST be able to reach the current content of every lead's report section
in the live (non-published) report, whether the section is `draft` or `submitted`;
submission status MUST NOT make content unreachable. On the live current period the
default view is **submitted-only** (see `report-submission-visibility`), with draft
sections one toggle away and their presence signalled — so the head can always get
to draft content, just not by default. The "No submissions yet" empty state MUST
render only when the report has no section content at all — NOT merely when the
submitted count is zero, and NOT when draft content exists but is filtered out by
the submitted-only default. This applies equally to the head's slide mode and the
head's edit/dashboard mode (both render the same report view).

#### Scenario: head opens a report with drafts and zero submissions

- **WHEN** the head opens a live report where leads have draft content but no
  section is yet submitted (`Live · 0/N Submitted`)
- **THEN** the default submitted-only view does NOT show the misleading "No
  submissions yet" empty state
- **AND** the presence of hidden draft sections is signalled with a way to show all
- **AND** switching the toggle to "all" reveals the draft content

#### Scenario: head opens a report with no content at all

- **WHEN** the head opens a live report where no section has any content
- **THEN** the empty state renders (there is genuinely nothing to show)

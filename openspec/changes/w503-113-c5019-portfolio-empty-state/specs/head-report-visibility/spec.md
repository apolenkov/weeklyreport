## ADDED Requirements

### Requirement: A published report without section content shows the no-content empty state

The weekly report surface MUST render the no-content empty state for a published
report whose sections have no content at all, the same as for a live report.
The Portfolio Overview MUST NOT render an empty grid in place of that state. The
empty state copy MUST follow the same rule as the live case: it distinguishes
absent content from absent submissions.

#### Scenario: published report with no content shows the empty state

- **GIVEN** a published report whose read model has no product content and no
  activity content
- **WHEN** a viewer opens the weekly report
- **THEN** the no-content empty state is shown
- **AND** no empty Portfolio Overview grid is rendered

#### Scenario: published report with content is unchanged

- **GIVEN** a published report with at least one product or activity content item
- **WHEN** a viewer opens the weekly report
- **THEN** the no-content empty state is not shown
- **AND** the Sections body and Portfolio Overview render as before

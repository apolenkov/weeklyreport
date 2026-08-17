## ADDED Requirements

### Requirement: Head desktop headers keep document actions right-aligned

The Head form and slides headers MUST use a stable desktop title/action layout in which the title, status, and department context occupy the flexible left column while `Document actions` occupy the intrinsic right column. A long context label MUST NOT wrap the complete action group onto a new left-aligned row.

#### Scenario: Publish is unavailable for the active report

- **WHEN** the Head report has no submitted section and the department context is long
- **THEN** Acknowledge and the disabled `Nothing to publish` control remain right-aligned in the document-action column
- **AND** the disabled primary continues to expose its publish precondition

### Requirement: Head slide context controls occupy one compact toolbar row

At desktop width, period/archive controls MUST remain the left cluster and Agent review, scope, view, and density controls MUST remain the right cluster of the single report context toolbar. The working Document/Presentation density choice MUST NOT render as a separate deck row.

#### Scenario: Head opens Leads presentation

- **WHEN** the Head selects Leads scope in slides mode
- **THEN** period/archive and all view controls remain in the single context toolbar
- **AND** the next deck row is the lead carousel rather than a second mode-control row

### Requirement: Lead slide context controls expose the working density choice

At desktop width, the Lead report context toolbar MUST keep period/archive controls in the left cluster and Agent review, record visibility, labeled view mode, density, and fullscreen controls in the trailing cluster. The working Document/Presentation density choice MUST NOT render as a second hosted deck row, while standalone Lead decks MAY keep their local density toolbar.

#### Scenario: Lead opens hosted slides

- **WHEN** a Lead opens slides mode for the addressed report
- **THEN** the context toolbar exposes visible desktop `Edit` and `Slides` labels
- **AND** exactly one Document/Presentation density control is present across the report context and deck
- **AND** the existing fullscreen control remains available

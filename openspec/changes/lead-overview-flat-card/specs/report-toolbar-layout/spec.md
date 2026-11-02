## MODIFIED Requirements

### Requirement: The lead document-action group holds no quick-add control

The Lead document-action group MUST contain Fill from and eligible Submit/reversal actions, plus Retry only for autosave recovery. Record creation MUST stay with the reporting-unit header Add item controls and the Risks/Decisions sections, not a report-header quick-add. Report/Slides switching MUST retain action order; read-only past periods MUST hide mutating actions.

#### Scenario: switching Report to Slides keeps the document actions

- **WHEN** a lead switches Report to Slides on an editable section
- **THEN** Fill from, any eligible Retry, and Submit keep their relative order and shared state
- **AND** no report-header `+ Add item` control or permanent Save appears

#### Scenario: a read-only past period hides the mutating actions

- **WHEN** the lead opens a read-only past period
- **THEN** Save/Retry, Submit, and Fill from are hidden

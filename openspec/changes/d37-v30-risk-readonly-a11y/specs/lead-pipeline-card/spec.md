# Spec Delta

## ADDED Requirements

### Requirement: Risk row action controls name the row non-emptily

The toggle-severity, edit and delete controls on a risk card MUST expose a
non-empty accessible name identifying the row, so a non-visual user gets the
same row identity a sighted user gets from the card title. When the stored
`productName` is empty or blank (for example an activity-parented row whose
activity name is unresolved), the label MUST fall back to the "Unknown"
placeholder of the lead-surface-name-resolution requirement "Lead-surface card
product names resolve report-wide" instead of dangling ("Edit risk for ").

#### Scenario: An activity-parented risk with an unresolved name

- **WHEN** a risk card renders with an empty or blank `productName`
- **THEN** its toggle, edit and delete controls expose names ending in the
  "Unknown" placeholder (for example "Edit risk for Unknown")
- **AND** the visible card title and the delete confirmation subtitle show the
  same "Unknown" name
- **AND** no action label ends in a blank

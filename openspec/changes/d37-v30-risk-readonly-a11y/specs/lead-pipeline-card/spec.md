# Spec Delta

## ADDED Requirements

### Requirement: Risk row action controls name the row non-emptily

The toggle-severity, edit and delete controls on a risk card MUST expose a
non-empty accessible name identifying the row, so a non-visual user gets the
same row identity a sighted user gets from the card title. When the stored
`productName` is empty or blank (for example an activity-parented row whose
activity name is unresolved), the label MUST fall back to a neutral
placeholder instead of dangling ("Edit risk for ").

#### Scenario: An activity-parented risk with an unresolved name

- **WHEN** a risk card renders with an empty or blank `productName`
- **THEN** its toggle, edit and delete controls expose names ending in the
  neutral fallback (for example "Edit risk for untitled")
- **AND** no action label ends in a blank

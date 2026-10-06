# Spec Delta

## ADDED Requirements

### Requirement: Weekly Activity fields MUST be disclosed on demand

The weekly title and description inputs of an Activity MUST NOT be permanently rendered below the Activity's timeline. They MUST open only when the lead activates the Activity's edit control, and saving, resetting to the catalogue name and cancelling MUST follow the existing section save and conflict handling. An Activity that has a weekly title or description MUST show that value as read-only text in the Activity header.

#### Scenario: An Activity has no weekly override

- **WHEN** the lead views a Project Activity without weekly fields
- **THEN** no weekly input is visible and the Activity shows the same Previous, Current and Next columns as a product

#### Scenario: The lead edits weekly fields

- **WHEN** the lead activates the Activity edit control
- **THEN** the weekly title and description inputs open with Save, Cancel and Reset to catalogue name
- **AND** cancelling closes them and returns focus to the edit control

## ADDED Requirements

### Requirement: Reset to catalogue name MUST NOT mark an unchanged title as a pending edit

Activating Reset to catalogue name in the weekly-fields editor MUST mark the
draft pending only when it changes the title. When the title is already empty,
Reset MUST leave the draft clean: it MUST NOT arm the unsaved-edit guard,
report the Activity as pending, or enable Save. An edit to the description made
before Reset MUST keep the draft pending.

#### Scenario: Reset on an Activity without a weekly title

- **GIVEN** the weekly-fields editor is open on an Activity whose weekly title is empty
- **WHEN** the lead activates Reset to catalogue name
- **THEN** the draft stays clean and Save stays disabled
- **AND** leaving the page raises no unsaved-edit prompt

#### Scenario: Reset after a description edit

- **GIVEN** the weekly title is empty and the lead has typed a description
- **WHEN** the lead activates Reset to catalogue name
- **THEN** the draft stays pending, Save stays enabled and the description is kept

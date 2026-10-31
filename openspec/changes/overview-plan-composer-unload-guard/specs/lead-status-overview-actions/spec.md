## ADDED Requirements

### Requirement: Overview plan composer MUST warn on unload only while input is edited

The Overview plan composer MUST warn before page unload or in-app navigation
only while its input differs from the state it opened with. The outcome choice
alone MUST NOT arm the warning, matching the composer's discard confirmation.
A pristine composer MUST NOT prompt.

#### Scenario: A pristine composer does not prompt on unload

- **GIVEN** the Overview plan composer has just opened with no edited input
- **WHEN** the page is unloaded
- **THEN** the unload proceeds without a browser confirmation

#### Scenario: Edited input arms the unload warning

- **GIVEN** the Overview plan composer is open
- **WHEN** the lead edits any input field beyond the outcome choice
- **THEN** page unload is prevented while the composer is open

#### Scenario: Restoring the opened input disarms the warning

- **GIVEN** the lead has edited the composer input
- **WHEN** the input is restored to the values the composer opened with
- **THEN** page unload proceeds without a browser confirmation

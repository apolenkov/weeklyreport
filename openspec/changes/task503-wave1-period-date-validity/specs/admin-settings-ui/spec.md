## ADDED Requirements

### Requirement: Manual period dialogs require parseable supplied envelope dates

The Admin Periods create and edit dialogs MUST reject a supplied start or end value that cannot produce a valid Date in their existing UTC submit format. The affected field MUST expose an associated inline error and submission MUST remain disabled until corrected. Valid dates, optional create ends, required edit ends and deadline semantics MUST retain their existing behavior.

#### Scenario: A supplied envelope date is unparseable

- **WHEN** a supplied start or end value cannot produce a valid submit Date
- **THEN** its field exposes an associated validation error
- **AND** submission is disabled and no manual-period mutation is sent

#### Scenario: An invalid envelope date is corrected

- **GIVEN** an invalid start or supplied end value blocks the dialog
- **WHEN** the Admin corrects it to a valid ordered envelope
- **THEN** its field error clears and submission is enabled
- **AND** submission preserves the existing UTC start and end-of-day values

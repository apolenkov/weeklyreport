## ADDED Requirements

### Requirement: Request changes validation failures use readable copy

The Request changes dialog SHALL validate the proposed verdict with reviewVerdictInputSchema before mutation and display "Enter a reason for the lead." without sending invisible-only input. It SHALL display readable action-specific copy for serialized validation issues returned by review.verdict, retain the typed reason, and remain open. It SHALL preserve meaningful domain rejection messages and MUST NOT expose the serialized issue array as dialog copy.

#### Scenario: Invisible-only text is blocked before a request

- **WHEN** the entered reason contains only invisible characters and fails reviewVerdictInputSchema
- **THEN** the dialog displays "Enter a reason for the lead." before making a request
- **AND** review.verdict is not called
- **AND** the original reason remains available for correction and the dialog stays open

#### Scenario: The section changes before the verdict is saved

- **WHEN** review.verdict returns a meaningful section-version conflict message
- **THEN** the dialog preserves that message and the typed reason without closing

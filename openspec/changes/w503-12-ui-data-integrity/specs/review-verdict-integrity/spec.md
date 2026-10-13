## ADDED Requirements

### Requirement: Request changes validation failures use readable copy

The Request changes dialog SHALL display readable action-specific copy for serialized validation issues returned by review.verdict, retain the typed reason, and remain open. It SHALL preserve meaningful domain rejection messages and MUST NOT expose the serialized issue array as dialog copy.

#### Scenario: Invisible-only text fails server validation

- **WHEN** a submitted nonempty reason contains only invisible characters and review.verdict rejects it with serialized validation issues
- **THEN** the dialog displays a readable request-changes failure message without the serialized issues
- **AND** the original reason remains available for correction and the dialog stays open

#### Scenario: The section changes before the verdict is saved

- **WHEN** review.verdict returns a meaningful section-version conflict message
- **THEN** the dialog preserves that message and the typed reason without closing

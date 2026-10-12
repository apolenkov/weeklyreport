## ADDED Requirements

### Requirement: Request Changes reason counter follows the shared text metric

The Request Changes reason counter SHALL count Unicode code points in the existing trimmed reason, consistently with the shared review verdict comment schema. The existing numeric native `maxlength`, trimming, required reason, pending guard and error behavior SHALL remain unchanged.

#### Scenario: Admitted non-BMP reason below the existing native cap

- **WHEN** the reviewer enters 500 non-BMP Unicode points whose native code-unit length is below the existing 2,000 cap
- **THEN** the associated reason counter displays 500 / 2000
- **AND** submitting sends the unchanged schema-admitted trimmed reason and current section version

#### Scenario: Existing empty and pending controls

- **WHEN** the reason is empty or a request is already pending
- **THEN** the existing refusal and pending behavior is preserved

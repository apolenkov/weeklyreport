## ADDED Requirements

### Requirement: Shared text boundaries reject selected invisible-only content

Shared `safeText` fields and report stage-name fields MUST reject values composed only of ECMAScript whitespace and U+00AD, U+034F, U+180E, U+200B–U+200D, U+2060–U+2064 or U+FEFF. Existing null-byte rejection, length bounds, optionality and validation messages MUST remain unchanged.

#### Scenario: Selected invisible characters cannot provide required text

- **WHEN** a shared text field receives any selected character alone, repeated or mixed with whitespace and the other selected characters
- **THEN** validation rejects it with the existing visible-content message

#### Scenario: Stage-name arrays use the same visible-content boundary

- **WHEN** a report write contains a stage name made only of the selected invisible characters and whitespace
- **THEN** validation rejects the stage name
- **AND** the existing stage-name array bounds and optional write-array policy remain unchanged

### Requirement: Successful shared text validation preserves the input

Shared text and stage-name validation MUST retain the exact successful input string, including whitespace, multilingual characters, combining marks, emoji sequences and the selected invisible characters within text that otherwise passes validation. Validation MUST NOT trim, normalize or remove characters from successful input.

#### Scenario: Multilingual and combined text keeps its exact representation

- **WHEN** otherwise valid text contains Cyrillic, CJK, Arabic, decomposed accented letters, joiner-based emoji or selected invisible characters alongside visible text
- **THEN** parsing succeeds and returns the exact input string

#### Scenario: Existing length and null-byte boundaries remain effective

- **WHEN** text exceeds its caller's length bound or contains a null byte even alongside visible characters
- **THEN** validation rejects it under the existing length or null-byte rule

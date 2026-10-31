## ADDED Requirements

### Requirement: Admin user write input validates free text as safe text

The admin user save input SHALL validate `name`, `lastName`, `firstName`, `middleName` and `position` with the shared `safeText` primitive, so that null bytes and values composed only of whitespace or invisible characters are rejected before storage. `middleName` and `position` MUST remain nullable. The read contract used for snapshot and stored values MUST NOT apply this rule.

#### Scenario: admin save rejects invisible-only name parts

- **WHEN** a `saveUser` payload has `lastName` composed only of a zero-width space
- **THEN** the input is rejected and nothing is stored

#### Scenario: admin save rejects null bytes in position

- **WHEN** a `saveUser` payload has `position` containing a null byte
- **THEN** the input is rejected

#### Scenario: nullable optional parts stay optional

- **WHEN** a `saveUser` payload has `middleName: null` and `position: null`
- **THEN** the input is accepted

#### Scenario: stored values are read without the write rule

- **WHEN** the admin snapshot or restore parses a stored user whose free-text field is whitespace-only or contains a null byte
- **THEN** the read contract accepts the stored value unchanged

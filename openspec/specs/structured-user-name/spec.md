# structured-user-name Specification

## Purpose

Define how a user's name is stored as structured ФИО parts (surname / first name
/ patronymic) alongside a denormalized display `name`, and how the display name,
short form, and avatar initials derive from those parts in surname-first order.

## Requirements

### Requirement: User stores structured name parts

The `User` model SHALL store three structured name columns in addition to the
existing display `name`: `lastName` (required), `firstName` (required), and
`middleName` (nullable).

#### Scenario: schema carries the parts

- **WHEN** the Prisma schema is inspected
- **THEN** `User` has `lastName String`, `firstName String`, and
  `middleName String?` alongside `name String`

#### Scenario: middle name is optional

- **WHEN** a user has no patronymic
- **THEN** `middleName` is `null` and the record is still valid

### Requirement: Canonical display name remains a stored field

The system SHALL keep `User.name` as a real, stored column that is denormalized
from the parts on write — it MUST NOT be computed/derived at read time.

#### Scenario: admin save recomputes and stores name

- **WHEN** the admin form saves a user with the three parts
- **THEN** `name` is recomputed from the parts and persisted as a stored value
- **AND** the three parts are persisted in the same write

#### Scenario: read sites are unchanged

- **WHEN** any existing consumer reads `User.name`
- **THEN** it receives the stored display name with no code change required

### Requirement: Display name composition order is ФИО

The recomputed display name SHALL be composed in surname-first ФИО order as
`[lastName, firstName, middleName]` joined by single spaces, omitting an absent
`middleName`, and trimmed.

#### Scenario: full ФИО

- **WHEN** parts are lastName="Петров", firstName="Алексей",
  middleName="Иванович"
- **THEN** the stored `name` is "Петров Алексей Иванович"

#### Scenario: no patronymic

- **WHEN** parts are lastName="Петров", firstName="Алексей", middleName=null
- **THEN** the stored `name` is "Петров Алексей"

### Requirement: Admin user form edits the structured parts

The admin Add/Edit-user dialog SHALL present three inputs — `Last name`,
`First name`, `Middle name` (English labels) — instead of a single `Name`
input, and on save MUST send the three parts plus the recomputed `name`.

#### Scenario: labels are English

- **WHEN** the dialog renders
- **THEN** the visible field labels are "Last name", "First name", "Middle name"
  (no hardcoded Cyrillic in the component)

#### Scenario: required parts gate save

- **WHEN** `Last name` or `First name` is empty
- **THEN** the form is invalid and Save is disabled
- **AND** an empty `Middle name` does not block save

#### Scenario: edit pre-fills parts

- **WHEN** an existing user is opened for edit
- **THEN** the three inputs are pre-filled from the stored parts

### Requirement: Shared admin user contract carries the parts

The shared `adminUserSchema` (and its `AdminUser` type) SHALL include
`lastName` (min 1), `firstName` (min 1), and `middleName` (nullable), keeping
`name` as the stored display value.

#### Scenario: contract validates parts at the boundary

- **WHEN** a `saveUser` payload is parsed
- **THEN** it requires non-empty `lastName` and `firstName`
- **AND** accepts `middleName` as a string or null

### Requirement: Short display form

The system SHALL provide a short name form composed as surname plus the
initials of the given name and patronymic — «Баленков А.В.», or «Баленков А.»
when there is no patronymic — and the admin Users table SHALL show this short
form.

#### Scenario: short form with patronymic

- **WHEN** parts are lastName="Баленков", firstName="Александр",
  middleName="Владимирович"
- **THEN** the short form is "Баленков А.В."

#### Scenario: short form without patronymic

- **WHEN** parts are lastName="Баленков", firstName="Александр", middleName=null
- **THEN** the short form is "Баленков А."

### Requirement: Initials derive surname + given name

The shared initials helper SHALL return surname-initial + given-name-initial
when structured parts are present (e.g. «БА»), and MUST NOT use the
first-word + last-word heuristic that yields surname + patronymic. When parts
are absent (e.g. a SAML stub), it SHALL fall back to a name-string heuristic
that takes the first and second whitespace tokens under the surname-first
order, and a single token yields its first two letters.

#### Scenario: initials from parts

- **WHEN** parts are lastName="Баленков", firstName="Александр",
  middleName="Владимирович"
- **THEN** the avatar initials are "БА" (not "БВ")

#### Scenario: initials fallback for a part-less record

- **WHEN** a record has only `name` "Баленков Александр Владимирович" and no
  parts
- **THEN** the initials are "БА" from the first two tokens

#### Scenario: session avatar uses parts

- **WHEN** the nav avatar renders for the session user
- **THEN** the session carries `lastName`/`firstName` (plumbed via `auth.me`)
  and the initials use them, falling back to `name` only when parts are null

### Requirement: Seeds populate structured parts

All seed datasets SHALL populate `lastName`/`firstName`/`middleName` for seeded
users and keep the stored `name` consistent with the ФИО composition order.

#### Scenario: seeded user has parts and a consistent name

- **WHEN** a seed creates a user
- **THEN** the three parts are set
- **AND** the stored `name` equals the ФИО-order composition of those parts

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

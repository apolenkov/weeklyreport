# structured-user-name

Structured ФИО (surname / first name / patronymic) for users, while keeping the
single `name` display field as the stored, denormalized canonical name.

## ADDED Requirements

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

### Requirement: SAML provisioning leaves parts unset

SAML login SHALL keep writing `name` from the assertion `displayName` and MUST
set `firstName`/`lastName`/`middleName` to `null`, since SAML supplies no name
parts.

#### Scenario: first SAML login

- **WHEN** a user is provisioned via SAML at `auth.routes.ts`
- **THEN** `name` is set to `profile.displayName`
- **AND** the three structured parts are `null`
- **AND** the user can later be given parts via the admin form

### Requirement: Seeds populate structured parts

All seed datasets SHALL populate `lastName`/`firstName`/`middleName` for seeded
users and keep the stored `name` consistent with the ФИО composition order.

#### Scenario: seeded user has parts and a consistent name

- **WHEN** a seed creates a user
- **THEN** the three parts are set
- **AND** the stored `name` equals the ФИО-order composition of those parts

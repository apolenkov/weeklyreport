# user-position

An admin-maintained HR job title (должность) on the user record, distinct from
the access `role`.

## ADDED Requirements

### Requirement: User stores an admin-maintained position

The `User` model SHALL store a nullable free-text `position` column representing
the person's HR job title, maintained only by the admin and never sourced from
the identity provider.

#### Scenario: schema carries position

- **WHEN** the Prisma schema is inspected
- **THEN** `User` has `position String?`

#### Scenario: position is independent of role

- **WHEN** a user has `role = "viewer"` and `position = "Тимлид"`
- **THEN** both are valid and stored — `position` does not constrain `role`

#### Scenario: IdP position is not pulled

- **WHEN** a user logs in via SAML/Keycloak
- **THEN** `position` is not read from or overwritten by the assertion

### Requirement: Position in the admin contract and UI

The shared `adminUserSchema` SHALL include `position: z.string().nullable()`,
the admin Add/Edit-user form SHALL present a `Position` input (English label),
and the Users table SHALL show a `Position` column.

#### Scenario: contract accepts a nullable position

- **WHEN** a `saveUser` payload is parsed
- **THEN** `position` is accepted as a string or null

#### Scenario: form edits position

- **WHEN** the admin edits a user
- **THEN** the form shows a `Position` input pre-filled from the stored value
- **AND** the Users table renders a `Position` column

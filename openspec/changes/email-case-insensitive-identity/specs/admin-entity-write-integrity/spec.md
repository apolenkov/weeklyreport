# Spec Delta

## ADDED Requirements

### Requirement: Live user email identity is case-insensitive

Every server-owned `User.email` write — admin create/update and snapshot
restore — MUST persist the canonical normalized form produced by the shared
`normalizeEmail` function (trim + lowercase, identical to the snapshot
uniqueness comparator). PostgreSQL MUST enforce the same identity with a
unique `lower("email")` index while the exact-case unique remains for Prisma
lookup compatibility. A case-variant second write MUST surface as the
existing typed admin conflict, never a raw database error, and MUST NOT
create a second user. The migration that introduces the index MUST refuse
to proceed while case-only duplicates exist, reporting only the conflicting
user ids — it MUST NOT merge users, memberships, or review history. Admin
email edits MUST NOT rewrite the stored `samlId`, and no email domain
allow-list is introduced.

#### Scenario: Case-variant admin write is a typed conflict

- **GIVEN** a user exists with email `admin@example.test`
- **WHEN** an admin write attempts to persist a different user with email
  `Admin@example.test`
- **THEN** the write fails with the typed admin conflict
- **AND** no second user row exists

#### Scenario: Mixed-case account stays reachable

- **GIVEN** a user persisted before normalization with email `Lead@Example.test`
- **WHEN** the lower(email) migration runs and a lookup resolves the account
- **THEN** the migration succeeds (no duplicate) and the account remains
  reachable through the case-insensitive email lookup

#### Scenario: Ambiguous duplicates stop the migration

- **GIVEN** two existing users whose emails differ only by case
- **WHEN** the lower(email) migration runs
- **THEN** it fails before creating the index and lists only the conflicting
  user ids
- **AND** no user, membership, or review data is merged or deleted

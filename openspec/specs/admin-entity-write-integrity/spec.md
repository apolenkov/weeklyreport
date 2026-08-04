# admin-entity-write-integrity Specification

## Purpose

Requires admin entity writes to resolve races cleanly rather than as raw 500s: product-attach and user-create unique-violation races surface as typed conflicts, and samlId is never rewritten on user update.

## Requirements

### Requirement: Product-attach races resolve cleanly, never as a raw 500

`attachProductToGroup` MUST catch a unique-constraint violation on its
product-attach `create` and resolve it to either the existing attach row or
a typed `AdminGroupProductConflictError`. It MUST NOT let a raw Prisma
unique-constraint error surface to the caller.

#### Scenario: Two concurrent first-attaches of the same product

- **GIVEN** two concurrent calls to `attachProductToGroup` for the same
  `groupId`/`productId` pair, neither of which has an existing attach row
- **WHEN** both calls execute
- **THEN** exactly one persists the attach
- **AND** the other resolves to the existing row or a typed
  `AdminGroupProductConflictError`
- **AND** neither call surfaces a raw unhandled database error

### Requirement: User-create races resolve cleanly, never as a raw 500

`upsertUser`'s create branch MUST catch a unique-constraint violation on the
seeded `samlId`/email collision and return a typed conflict error instead of
letting a raw Prisma unique-constraint error surface to the caller.

#### Scenario: Concurrent creation of users sharing an email

- **GIVEN** two concurrent `upsertUser` calls that both resolve to a create
  (no existing user with that id) and share the same email
- **WHEN** both calls execute
- **THEN** exactly one persists
- **AND** the other returns a typed conflict error, not a raw unhandled
  database error

### Requirement: samlId is never rewritten on user update

`upsertUser`'s update branch MUST NOT write to the `samlId` column under any
circumstance, including when the user's email changes. `samlId` is the
external SAML identity key, seeded once at creation, and any change to it on
update would desynchronize the stored identity from the SAML IdP's assertion
for that user.

#### Scenario: Admin edits a user's email

- **GIVEN** an existing user with a `samlId` set at creation
- **WHEN** an admin edits that user's email via `upsertUser`
- **THEN** the persisted `samlId` is unchanged from its value before the edit

### Requirement: Project-activity group moves and lead attachments preserve group equality atomically

The `projectActivity` update and `attachLead` repository operations MUST validate the activity group, every attached lead group, and the requested mutation within one serializable transaction or an equivalent database-enforced atomic command.

#### Scenario: Attach races with a group move

- **WHEN** lead attachment validates the old group while a concurrent transaction moves the activity
- **THEN** at most one transaction commits and the final database contains no cross-group attachment

#### Scenario: Group move races with an attachment

- **WHEN** a group move validates the existing lead set while a concurrent transaction attaches a lead from the old group
- **THEN** at most one transaction commits and the losing operation returns a typed retryable conflict

#### Scenario: Matching groups remain valid

- **WHEN** the activity and lead remain in the same group for the complete transaction
- **THEN** attachment or group movement commits once without changing unrelated edges

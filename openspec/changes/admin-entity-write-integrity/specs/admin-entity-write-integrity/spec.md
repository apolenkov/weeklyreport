## ADDED Requirements

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

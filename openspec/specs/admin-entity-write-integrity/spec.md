# admin-entity-write-integrity Specification

## Purpose

Requires admin entity writes to resolve races cleanly rather than as raw 500s: product-attach and user-create unique-violation races surface as typed conflicts, samlId is never rewritten on user update, and writes on a missing target surface a typed not-found. User identity and history rules live in `admin-user-identity-integrity`; group, assignment and ownership rules live in `admin-assignment-group-integrity`.

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

### Requirement: Detaching a product never breaks report reads

`admin.detachProductFromGroup` MAY leave a product without a `GroupProduct`
owner (detach then attach is the supported way to move a product). The live
report read MUST keep succeeding for every role when a staffed product has no
owner: the product's frozen `ownerGroupId` is `null`, and the cross-group
signal treats `null` as "no foreign owner".

#### Scenario: Staffed product detached from its only group

- **GIVEN** a product with a stage assignment in an open report
- **WHEN** an administrator detaches it from its group
- **THEN** `weeklyReport.get` for the open report still succeeds
- **AND** the product's `ownerGroupId` in the lead section is `null`

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

### Requirement: Catalog writes on a missing target surface a typed not-found

Archiving a project or reporting group and deleting a reminder policy each
target a router-validated UUID. When the row is absent — including when it
vanished between validation and the write — the Prisma missing-row error
(P2025) MUST be translated into a typed domain error that maps to
`NOT_FOUND` with a fixed, safe message. Every other persistence failure MUST propagate
unchanged into the generic masked internal error. Output schema parsing MUST
stay outside the missing-row catch so a corrupt row never masquerades as a
missing one, and repeated archive of an existing already-archived row MUST
remain a success.

#### Scenario: Archiving a missing project

- **WHEN** `admin` project archive targets a validated UUID with no row
- **THEN** the call fails with `NOT_FOUND` and a fixed safe message, never a
  generic internal error

#### Scenario: Archiving a missing reporting group

- **WHEN** `admin` reporting-group archive targets a validated UUID with no
  row
- **THEN** the call fails with `NOT_FOUND` and a fixed safe message

#### Scenario: Deleting a missing reminder policy

- **WHEN** `admin` reminder-policy delete targets a validated UUID with no
  row — including a repeated delete
- **THEN** the call fails with `NOT_FOUND` and a fixed safe message

#### Scenario: A non-missing failure stays internal

- **WHEN** the catalog write fails for any persistence reason other than a missing row
  (database outage, unrelated constraint)
- **THEN** the original error propagates unchanged into the masked
  `INTERNAL_SERVER_ERROR`

#### Scenario: Repeated archive of an existing row succeeds

- **GIVEN** a project or reporting group row that is already archived
- **WHEN** the archive write runs again
- **THEN** it succeeds idempotently and no physical deletion occurs

### Requirement: Missing stage-assignment targets and references fail as typed NOT_FOUND

`saveStageAssignment` MUST translate a foreign-key violation (`P2003`) on one
of the assignment's own reference constraints (`userId`, `stageId`,
`projectId`) — including on the fresh retry transaction after a lost
unique-constraint race — into a typed not-found domain error so the caller
receives `NOT_FOUND` with a fixed safe message, and MUST NOT persist a
partial assignment. A `P2003` on any other constraint and every other
persistence failure MUST propagate unchanged. `deleteStageAssignment` MUST
translate a missing-row failure (`P2025`) into a typed not-found domain
error. Malformed (non-UUID) input MUST keep being rejected by input
validation before persistence.

#### Scenario: Saving an assignment with an absent reference

- **GIVEN** a validated `userId`/`stageId`/`projectId` tuple where the named
  user, stage, or project does not exist
- **WHEN** `saveStageAssignment` is called
- **THEN** the call fails with `NOT_FOUND` and a fixed safe message
- **AND** no `StageAssignment` row is persisted
- **AND** no raw database error reaches the caller

#### Scenario: Deleting an absent assignment

- **GIVEN** no `StageAssignment` row exists for a validated UUID
- **WHEN** `deleteStageAssignment` is called for it
- **THEN** the call fails with `NOT_FOUND` and a fixed safe message

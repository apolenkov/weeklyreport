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

### Requirement: Published history permanently retains its publisher user

An administrator MUST NOT hard-delete a `User` referenced by
`Report.publishedById`. The targeted remove command MUST return a typed
`AdminUserPublishedHistoryError` that directs the administrator to deactivate
the user instead. The canonical foreign key MUST use `ON DELETE RESTRICT` so a
publication racing the application guard cannot lose its publisher identity.
Deactivation MUST remain supported and MUST preserve both the report column and
the immutable snapshot metadata.

#### Scenario: Administrator tries to delete a publisher

- **GIVEN** a published report references a user through `publishedById`
- **WHEN** an administrator requests hard deletion of that user
- **THEN** deletion fails with `AdminUserPublishedHistoryError`
- **AND** the published report and its immutable publisher metadata are unchanged

#### Scenario: Publication races with user deletion

- **GIVEN** the application guard initially sees no published report for a user
- **WHEN** a publication commits before the user delete
- **THEN** the restrictive foreign key rejects the delete
- **AND** the repository translates the publisher reference into
  `AdminUserPublishedHistoryError`, never a raw database error

#### Scenario: Publisher is deactivated

- **GIVEN** a published report references an active user
- **WHEN** an administrator deactivates that user
- **THEN** `User.isActive` becomes `false`
- **AND** admin snapshot export remains valid with the same `publishedById`

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

### Requirement: Assignment writes reconcile only live editable report rows

Project-activity lead attachment/detachment and product lead assignment MUST
reconcile their per-section status rows in the same transaction as the
assignment. The transaction MUST lock affected parent reports in deterministic
id order and re-check the complete editable lifecycle after each lock. An
attachment or assignment MUST backfill a missing status row for an existing
editable section; detachment or reassignment MUST remove only the outgoing
owner's status rows from editable sections. Published, archived, and otherwise
closed sections are immutable and MUST remain byte-identical. A later section
provisioning write remains responsible for materializing a row when the
assignment commits before the section is created.

Every writer of the assignment/status graph, including section provisioning,
section saves, activity attachment/detachment, targeted product assignment,
and snapshot restore, MUST first acquire the shared transaction-scoped status
graph serialization boundary. This boundary MUST cover the candidate-report
scan and all derived status writes, so a report committed after a scan cannot
be provisioned with an obsolete owner or activity edge. The MVP MAY implement
this as one PostgreSQL transaction-scoped advisory lock; a narrower key is
allowed only when every report-creation and status-seeding path is covered.

#### Scenario: Attaching a lead backfills an existing editable section

- **GIVEN** an editable report section already exists for a lead and an
  activity is not yet attached to that lead
- **WHEN** the activity is attached
- **THEN** the activity edge and one empty `ActivityStatus` row commit together
- **AND** the row is visible immediately without recreating the section

#### Scenario: Detaching cannot delete a published activity status

- **GIVEN** the lead has activity statuses in both an editable section and a
  published section
- **WHEN** the activity is detached
- **THEN** only the editable status row is removed
- **AND** the published status and its snapshot remain unchanged

#### Scenario: Reassigning a product reconciles live owners

- **GIVEN** an editable section for the old product lead and an editable
  section for the new product lead
- **WHEN** an administrator changes the product's lead
- **THEN** the old lead's `ProjectStatus` row is removed and the new lead's row
  is materialized with an empty status
- **AND** statuses in published or archived sections are untouched

#### Scenario: A report created after an assignment scan cannot receive stale statuses

- **GIVEN** a product assignment transaction has acquired the shared status
  graph boundary and scanned editable reports
- **WHEN** a new editable report is committed before a lead section is first
  provisioned for it
- **THEN** provisioning waits for the assignment transaction's boundary
- **AND** the new section's project and activity statuses reflect the
  committed assignment graph, not the pre-scan graph

### Requirement: User identity changes preserve activity assignment integrity

Targeted user updates and snapshot restores MUST lock the user row before
reading `ProjectActivityLead` edges or live product ownership. A user with an
activity attachment or product ownership MUST remain a `lead`; their reporting
group MUST continue to match each attached activity or product's group
ownership. A role or group change that would invalidate any edge MUST fail with
a typed conflict and MUST NOT update the user. Project-activity attachment
MUST acquire the same user-row lock before validating or writing the edge, so a
concurrent identity change cannot commit a cross-group or non-lead attachment.
Existing published data remains untouched.

The shared identity lock MUST use PostgreSQL `FOR NO KEY UPDATE`, not
`FOR UPDATE`. Section provisioning locks the parent `Report` first and then
inserts child rows referencing `User`; the foreign-key check takes a `KEY
SHARE` lock on the user. `FOR NO KEY UPDATE` preserves serialization of user
identity writes while remaining compatible with that foreign-key check, so the
two valid write paths cannot form a User/Report deadlock.

#### Scenario: Role change with an activity edge fails closed

- **GIVEN** a lead is attached to an activity
- **WHEN** an administrator changes the user's role to `viewer`
- **THEN** the update returns a typed conflict and the user remains a lead
- **AND** the activity edge remains valid

#### Scenario: Reporting-group change with an activity edge fails closed

- **GIVEN** a lead is attached to an activity in group A
- **WHEN** an administrator moves the user to group B
- **THEN** the update returns a typed conflict and the user remains in group A

#### Scenario: Assignment and first section provisioning do not deadlock

- **GIVEN** a lead owns a product and an editable report has no section for
  that lead
- **WHEN** product assignment reconciliation and first section provisioning
  interleave in either order
- **THEN** both transactions complete or one returns a typed retryable
  conflict within the transaction timeout
- **AND** no PostgreSQL deadlock is surfaced
- **AND** the final report section and editable `ProjectStatus` rows match the
  committed lead assignment

#### Scenario: Snapshot restore cannot invalidate an activity edge

- **GIVEN** a restored snapshot changes the role or reporting group of an
  attached lead incompatibly
- **WHEN** the snapshot is applied
- **THEN** restore fails with a typed conflict and the existing user and edge
  remain unchanged

#### Scenario: A product owner cannot leave the lead role

- **GIVEN** a lead owns a product through its current assignment
- **WHEN** an administrator changes the user's role to `viewer`
- **THEN** the update returns a typed conflict and the product ownership
  remains valid

### Requirement: An administrator cannot lock the project out of administration

The `admin.deactivateUser`, `admin.deleteUser`, and `admin.saveUser` procedures
MUST reject, on the server, a write by an administrator that deactivates,
deletes, or removes the `admin` role from their own account, with a
`BAD_REQUEST` and a fixed message. Independently of the actor, a write MUST
be rejected with a `CONFLICT` when it would leave no active administrator.
The check MUST lock the active administrator rows in the same transaction as
the write so concurrent demotions serialize. The admin Users table MUST
disable Deactivate and Delete on the signed-in administrator's own row, and the
Edit user dialog MUST lock the Role field for it, each with a visible or
accessible explanation.

#### Scenario: Self-deactivation is refused

- **GIVEN** an active administrator is signed in
- **WHEN** they call `admin.deactivateUser` with their own id
- **THEN** the call fails with `BAD_REQUEST` and the account stays active

#### Scenario: The last active administrator is protected

- **GIVEN** exactly one active administrator exists
- **WHEN** another actor deactivates, deletes, or demotes that user
- **THEN** the call fails with `CONFLICT` and the user stays an active admin

### Requirement: Catalog writes on a missing target surface a typed not-found

Archiving a project or reporting group and deleting a reminder policy each
target a router-validated UUID. When the row is absent — including when it
vanished between validation and the write — the Prisma missing-row error
(P2025) MUST be translated into a typed domain error that maps to
`NOT_FOUND` with a fixed, safe message. Every other failure MUST propagate
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

- **WHEN** the catalog write fails for any reason other than a missing row
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

### Requirement: Live user email identity is case-insensitive

Admin create/update and snapshot restore MUST persist canonical `User.email`
with the shared `normalizeEmail` (trim + lowercase), matching snapshot uniqueness.
PostgreSQL MUST enforce `User_email_lower_key` on `lower("email")` while retaining
the exact-case unique for Prisma. A case-variant second write MUST return the
existing typed admin conflict without creating another user.

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

#### Scenario: Canonical email preserves the external key and domain policy

- **GIVEN** an existing user with a `samlId` set at creation
- **WHEN** an admin edits the user's email
- **THEN** `User.email` is stored in its trimmed, lowercase form
- **AND** the existing `samlId` is unchanged
- **AND** no corporate-domain allow-list is introduced

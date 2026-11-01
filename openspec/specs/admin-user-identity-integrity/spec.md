# admin-user-identity-integrity Specification

## Purpose

Defines how Admin user writes keep identity, publisher and reviewer history, activity assignments and the last administrator intact.

## Requirements

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

### Requirement: Live review history retains its reviewer user

The admin user deletion command MUST reject hard deletion while any live ReviewAcknowledgement.user, SectionReview.reviewer or RecordComment.reviewer reference exists, returning the existing typed conflict with deactivation guidance. User identity and referenced history MUST remain intact. Database referential integrity MUST enforce refusal atomically, including concurrent deletion/reference writes.

#### Scenario: Any acknowledgement retains its user

- **GIVEN** a user is referenced by a live ReviewAcknowledgement and has no other deletion-blocking reference
- **WHEN** the administrator requests hard deletion
- **THEN** deletion fails with a typed conflict and the user and acknowledgement remain unchanged

#### Scenario: Any verdict retains its reviewer

- **GIVEN** a user is referenced by a live SectionReview and has no other deletion-blocking reference
- **WHEN** the administrator requests hard deletion
- **THEN** deletion fails with a typed conflict and the user and verdict remain unchanged

#### Scenario: Any comment retains its reviewer

- **GIVEN** a user is referenced by a live RecordComment and has no other deletion-blocking reference
- **WHEN** the administrator requests hard deletion
- **THEN** deletion fails with a typed conflict and the user and comment remain unchanged

#### Scenario: Reviewer deactivation preserves history

- **GIVEN** any of the live review-history references retains its user
- **WHEN** the administrator deactivates that user instead
- **THEN** the user becomes inactive and all review-history rows and unrelated data remain unchanged

#### Scenario: A reference-free user can still be removed

- **GIVEN** the user has no review-history or other deletion-blocking reference and existing administrator protection allows deletion
- **WHEN** the administrator requests hard deletion
- **THEN** only that user is deleted and unrelated users and history remain unchanged

#### Scenario: A review reference competes with hard deletion

- **WHEN** a review-history reference and deletion of its user compete
- **THEN** the database cannot commit both a live orphaned reference and the deletion
- **AND** a reference that commits first retains its user and history

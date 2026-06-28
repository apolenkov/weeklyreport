## ADDED Requirements

### Requirement: Snapshot write phases commit atomically

The admin snapshot write SHALL apply all of its entity phases inside a single interactive `prisma.$transaction`, so a failure in any phase rolls back every phase and leaves the database exactly as it was before the call.

This governs `AdminRepository.saveSnapshot`, implemented by `saveSnapshot` in
`admin-snapshot-write.queries.ts`, across the reporting-group, user, project,
period, and reminder-rule phases. EVERY database write the call performs runs
inside the transaction — including the fallback reporting-group provisioning
(`ensureFallbackReportingGroup`), which itself upserts a default group and so
must not be allowed to commit on its own ahead of a later-phase failure.

This requirement is about all-or-nothing persistence, not about which rows are
touched (that is governed separately by "Admin mutations target only the
referenced entity").

#### Scenario: Mid-write failure leaves no partial state

- **GIVEN** a snapshot write that has already upserted users
- **WHEN** a later phase (e.g. the project or reminder-rule phase) throws
- **THEN** the user upserts are rolled back with the rest of the transaction
- **AND** the database matches its pre-call state, with no manual recovery
  needed.

#### Scenario: Fallback-group provisioning rolls back with a later failure

- **GIVEN** a snapshot whose groups are all archived, so the write provisions a
  default fallback reporting group
- **WHEN** a later phase (e.g. the user or reminder-rule phase) throws
- **THEN** the fallback group insert is rolled back with the rest of the
  transaction
- **AND** no default reporting group is left committed in the database.

#### Scenario: Successful write commits every phase together

- **GIVEN** a valid snapshot covering groups, users, projects, periods, and
  reminder rules
- **WHEN** `saveSnapshot` completes without error
- **THEN** all phases are committed in one transaction
- **AND** a concurrent reader never observes a state where only some phases are
  applied.

### Requirement: Admin mutations target only the referenced entity

An admin add or edit of a single user, project, reporting group, reminder rule, or report period SHALL persist only that entity by id and SHALL NOT delete, archive, or overwrite any row that the admin did not reference.

The whole-snapshot destructive reconcile — which deleted users/reminder rules
and archived projects merely for being absent from the in-memory snapshot — is
removed. Equally, no single-entity edit re-writes unrelated collections from the
caller's stale `getSnapshot` read: each add/edit goes through a targeted upsert
by id rather than `getSnapshot → saveSnapshot`. This closes the data-loss window
where a row created between the caller's `getSnapshot` read and the write (for
example a SAML just-in-time user) was reconciled away or clobbered with a stale
copy.

`PeriodAdminService.upsertPeriod` is covered by this requirement: it formerly
read the whole snapshot and re-saved it, so a period edit could overwrite stale
copies of groups, users, projects, and reminder rules; it now upserts only the
named period.

#### Scenario: Concurrent insert survives an unrelated edit

- **GIVEN** an admin edits one existing user
- **AND** a different user row is created (e.g. by SAML just-in-time login)
  after the admin's snapshot was read but before the write commits
- **WHEN** the admin's edit is persisted
- **THEN** only the edited user row is written
- **AND** the concurrently-created user still exists afterwards.

#### Scenario: Editing one project does not archive the others

- **GIVEN** several active projects exist
- **WHEN** an admin upserts a single project
- **THEN** only that project row is created or updated
- **AND** no other project is archived as a side effect.

#### Scenario: Editing one period does not overwrite unrelated collections

- **GIVEN** an admin edits one report period
- **AND** a user, project, or reminder rule was created (or edited by another
  actor) after the admin's snapshot was read but before the write commits
- **WHEN** the admin's period edit is persisted
- **THEN** only the named period row is created or updated
- **AND** the concurrently-created or concurrently-edited rows are neither
  deleted nor reverted to the admin's stale copy.

### Requirement: Entity removal is explicit, not reconcile-driven

Removing a user, project, or reminder rule SHALL be an explicit delete or
archive of the named id, exposed as a dedicated `AdminRepository` operation,
rather than being inferred from the entity's absence in a whole-snapshot write.

The caller services (`SnapshotAdminService.removeUser`,
`ProjectAdminService.removeProject`, `ReminderAdminService.removeReminderRule`)
SHALL invoke these targeted operations instead of filtering the entity out of
the snapshot and re-saving the whole snapshot.

#### Scenario: Remove user deletes only the named user

- **GIVEN** an admin requests removal of one user by id
- **WHEN** the removal is persisted
- **THEN** only that user is considered for deletion
- **AND** all other users and reminder rules remain untouched.

#### Scenario: Remove project archives only the named project

- **GIVEN** an admin requests removal of one project by id
- **WHEN** the removal is persisted
- **THEN** only that project is archived
- **AND** no other project or user row is changed.

### Requirement: User deletion preserves the referential-integrity guard

A targeted user deletion SHALL skip the delete when the user is still
referenced by a `ReportSection` (as author) or a `Project` (as lead), and SHALL
treat a Prisma `P2003` foreign-key violation as a no-op skip rather than an
error.

This preserves the existing guard at the deletion point so that removing a user
who authored sections or leads a project does not orphan or fail those records.

#### Scenario: Referenced user is not deleted

- **GIVEN** a user who authored at least one report section or leads a project
- **WHEN** an admin removes that user
- **THEN** the delete is skipped
- **AND** the user and their referencing rows remain intact.

#### Scenario: Foreign-key violation is swallowed as a skip

- **GIVEN** a user delete that races a new reference and trips Prisma `P2003`
- **WHEN** the delete executes
- **THEN** the error is treated as a skip
- **AND** the surrounding write still completes successfully.

### Requirement: Period restore reinstates the full governed lifecycle set

Persisting a period row through the snapshot write SHALL reinstate the complete
governed lifecycle set (`status`, `periodState`, `periodStatus`, `archived`,
`autoPublished`, `autoArchived`, and the published/reopened timestamps) verbatim
via `resolveLifecycle`, treating the write as a non-transition restore and NOT
deriving the coupled fields from any single field.

This preserves legitimately-divergent rows — for example a reopened period that
is `status='published'` while `periodState='open'` and
`periodStatus='reopened'` — across a snapshot restore.

#### Scenario: Reopened period keeps its divergent lifecycle tuple

- **GIVEN** a period with `status='published'`, `periodState='open'`, and
  `periodStatus='reopened'`
- **WHEN** that period is persisted by the snapshot write
- **THEN** all three fields are written exactly as given
- **AND** the row is not coerced to a single-field-derived transition state.

### Requirement: Reminder-policy materialization runs after commit

After a period is newly created, the write path SHALL run
`PolicyApplicatorService.applyToPeriod` for it OUTSIDE the committing write, so
that a failure in the applicator cannot roll back the committed period. This
holds whether the period is created by the whole-snapshot `saveSnapshot` write
or by the targeted `upsertPeriod` mutation.

#### Scenario: Applicator failure does not undo committed periods

- **GIVEN** a snapshot write that creates one or more new periods
- **AND** `applyToPeriod` later throws (e.g. an unreachable Prisma engine)
- **WHEN** the write returns
- **THEN** the newly-created periods remain committed
- **AND** only the post-commit applicator step is reported as failed.

#### Scenario: Targeted period create still materializes its policies

- **GIVEN** an admin creates a new period through the targeted `upsertPeriod`
  mutation
- **WHEN** the period write commits
- **THEN** `applyToPeriod` runs for the new period AFTER the commit
- **AND** an applicator failure leaves the newly-created period committed.

### Requirement: Whole-snapshot restore is additive-only

The retained `AdminRepository.saveSnapshot` whole-snapshot write SHALL be additive-only: it upserts every supplied row and SHALL NOT delete or archive any existing row merely for being absent from the supplied snapshot.

Removals never occur through snapshot absence; they are performed only by the
targeted removal operations (`removeUser`, `removeProject`,
`removeReminderRule`). This is the decided removal contract for `saveSnapshot` —
not an implementation choice deferred to later. A future import path that
genuinely needs whole-snapshot removals would carry an explicit deletion id-set;
absence alone is never a deletion signal.

#### Scenario: Absent user is not deleted by a restore

- **GIVEN** a user exists in the database
- **AND** a `saveSnapshot` payload that does not include that user
- **WHEN** the snapshot write commits
- **THEN** the absent user is still present afterwards
- **AND** is neither deleted nor archived.

#### Scenario: Absent project is not archived by a restore

- **GIVEN** an active project exists in the database
- **AND** a `saveSnapshot` payload that does not include that project
- **WHEN** the snapshot write commits
- **THEN** the absent project remains active afterwards.

#### Scenario: Absent reminder rule is not deleted by a restore

- **GIVEN** a reminder rule exists in the database
- **AND** a `saveSnapshot` payload that does not include that rule
- **WHEN** the snapshot write commits
- **THEN** the absent reminder rule still exists afterwards.

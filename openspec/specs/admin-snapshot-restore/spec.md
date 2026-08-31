# admin-snapshot-restore

## Purpose

Admin recovery snapshot export/import (`getSnapshot` / `saveSnapshot`) for the
listed admin entities, reminder delivery state, and immutable published report
documents. It is not a full database-disaster-recovery backup: mutable draft
sections and their records remain the responsibility of PostgreSQL backup and
restore.

## Requirements

### Requirement: Snapshot export is one validated database view

`getSnapshot` MUST read every exported entity inside one PostgreSQL
`REPEATABLE READ` or stronger transaction and MUST validate the assembled
cross-entity snapshot before that transaction completes. A current-version
snapshot MUST explicitly carry every top-level collection, including empty
`groups`, `policies`, and `reminderExecutions` arrays; omission MUST NOT be
interpreted as an older empty state.

#### Scenario: concurrent writes cannot produce a torn export

- **WHEN** users, periods, reminder rules, executions, and policies are exported
- **THEN** all reads observe one repeatable database snapshot
- **AND** cross-reference validation runs before the export is returned

#### Scenario: a current collection is omitted

- **WHEN** a restore payload omits `groups`, `policies`, or
  `reminderExecutions`
- **THEN** current-version snapshot validation rejects it before any write

### Requirement: Snapshot identity graph is deterministic and self-contained

Before opening the restore transaction, `saveSnapshot` MUST reject duplicate
row ids in every top-level collection and duplicate persisted business keys,
including case-insensitive user email, the reminder-rule
`(reportId, policyId, version)` business key,
and reminder-execution `dedupeKey`. Validation MUST NOT let array order choose a
last winning row. The same pre-transaction result MUST hold against an empty or
already-populated database.

Every snapshot foreign key needed by restore MUST resolve inside the same
payload: user `reportingGroupId` to a snapshot group, group `headUserId` to a
snapshot head/admin user, project `leadId` and period `publishedById` to a
snapshot user, reminder-rule ownership to snapshot report/policy, and execution
ownership to its snapshot rule/report. Restore MUST NOT borrow a matching live
database row to make an incomplete payload valid.

#### Scenario: duplicate identity appears in a restore payload

- **WHEN** two rows share an id, user email, reminder-rule business key, or
  execution dedupe key
- **THEN** validation identifies the later duplicate deterministically
- **AND** no restore transaction starts

#### Scenario: a foreign key exists only in the populated target database

- **WHEN** a snapshot omits a referenced group, user, report, policy, or rule
- **THEN** validation rejects it equally against fresh and populated targets
- **AND** existing target state is never used to complete the snapshot graph

### Requirement: Snapshot periods preserve immutable published content

The admin snapshot period contract MUST carry the required nullable
admin-editable `weekLabel` and `publishedSnapshot` separately from the UI
`ReportPeriod` contract. Draft publication snapshots MUST contain `null`; every row
whose lifecycle `status` is `published` (including reopened and archived
published rows) MUST contain a structurally valid `AssembledReport` snapshot.
`getSnapshot` MUST export that value and `saveSnapshot` MUST restore it in the
same database write as the period lifecycle fields. Restore MUST NOT rebuild a
published document from mutable live sections. The snapshot identity,
publication status, publication timestamp, and publisher MUST match the Report
row. A closed publication's period envelope MUST also match; a reopened report
MAY carry a newly edited live envelope while retaining its prior immutable
publication envelope until it is published again.

Both `AssembledReport` and `PublishedReportSnapshot` MUST reject duplicate
section ids, duplicate section author ids, and duplicate frozen record
identities. A record identity is the exact `(recordType, id)` pair across all
sections and the `items`, `risks`, and `decisions` collections; its `stableId`
lineage does not replace or widen that namespace. Projection builders MUST
reuse this canonical validation before deriving rows.

`PublishedSectionScope` and `PublishedSearchDocument` are derived recovery
indexes, not separate snapshot payloads. `saveSnapshot` MUST delete and rebuild
both projections from each validated `publishedSnapshot` inside the same
restore transaction, including clearing them for a draft period. Projection
rows MUST retain frozen section/group/record identifiers without foreign keys
to the mutable live graph.

#### Scenario: a published period survives admin recovery

- **WHEN** an admin snapshot is exported and restored
- **THEN** the published period's immutable snapshot is byte-equivalent in
  meaning to the exported `AssembledReport`
- **AND** the restored row remains readable without querying mutable live
  sections
- **AND** its frozen authorization and full-text projections are reconstructed
  from the restored snapshot

#### Scenario: a draft period has no publication document

- **WHEN** a draft period is exported or restored
- **THEN** its `publishedSnapshot` is explicitly `null`

#### Scenario: a fresh restore retains the period label

- **GIVEN** an admin snapshot period has a non-null `weekLabel`
- **WHEN** it is restored after the original Report row is absent
- **THEN** the created Report carries the exact same label
- **AND** omitting `weekLabel` from a current snapshot fails validation rather
  than silently restoring `null`

#### Scenario: malformed publication data is rejected before restore

- **WHEN** a published period omits or supplies an invalid `publishedSnapshot`
- **THEN** snapshot validation fails before the restore transaction starts

#### Scenario: malformed publication identities are rejected before restore

- **WHEN** a published snapshot repeats a section id, author id, or a
  `(recordType, id)` pair
- **THEN** `saveSnapshot` rejects it before opening a restore transaction
- **AND** equal ids in different record-type namespaces remain valid

#### Scenario: publication metadata contradicts the row

- **WHEN** a snapshot has the expected shape but its report identity,
  publication timestamp, publisher, or closed-period envelope differs from the
  Report row
- **THEN** snapshot validation fails before the restore transaction starts

#### Scenario: a reopened report retains its prior publication envelope

- **WHEN** a reopened report's editable period envelope differs from its last
  immutable publication snapshot
- **THEN** snapshot validation accepts both values and restore preserves them

### Requirement: Snapshot publisher identities remain restorable

Every non-null `publishedById` carried by a snapshot period MUST reference a
user retained in the same admin snapshot. Published history MUST prevent hard
deletion of that user; offboarding uses `isActive=false` instead. Snapshot
export and restore MUST preserve the user row, its active state, the report
publisher id, and the immutable snapshot publisher id without rewriting the
frozen document.

#### Scenario: a deactivated publisher survives recovery

- **GIVEN** a published report whose publisher has been deactivated
- **WHEN** an admin snapshot is exported and restored
- **THEN** the publisher user remains present with `isActive=false`
- **AND** the Report and immutable snapshot retain the same `publishedById`

#### Scenario: a snapshot omits a referenced publisher

- **WHEN** a snapshot period has a non-null `publishedById` whose user is absent
  from the snapshot users
- **THEN** validation rejects the snapshot before restore starts

### Requirement: Snapshot restore applies reporting-group head assignments

Admin recovery restore (`saveSnapshot`) MUST write each group's
`headUserId` from the supplied snapshot, on both newly-created and
already-existing `ReportingGroup` rows. The head-assignment write MUST run
only after every user in the snapshot has been upserted, so a group's head
can reference a user created by the same restore. A group with no head in
the snapshot MUST have its stored `headUserId` cleared to `null`.

Before assigning a non-null head, restore MUST lock that user row and re-read
the current role. The role MUST be `head` or `admin`; restore MUST reject the
write otherwise. User role updates MUST use the same user-first lock and MUST
reject demoting a user referenced by any current `ReportingGroup.headUserId`.

#### Scenario: a snapshot import sets a new group's head

- **WHEN** `saveSnapshot` restores a group that does not yet exist in the
  database, and the snapshot's `headUserId` for that group references a
  user included in the same snapshot's `users` array
- **THEN** the created `ReportingGroup` row's `headUserId` matches the
  snapshot value
- **AND** `getSnapshot` returns that same `headUserId` for the group

#### Scenario: a snapshot restore changes an existing group's head

- **WHEN** `saveSnapshot` restores a group that already exists in the
  database with a different `headUserId` than the snapshot supplies
- **THEN** the stored `headUserId` is updated to the snapshot's value

#### Scenario: a snapshot restore clears a group's head

- **WHEN** `saveSnapshot` restores a group whose snapshot `headUserId` is
  `null` or absent, and the existing stored row has a non-null `headUserId`
- **THEN** the stored `headUserId` is cleared to `null`

#### Scenario: a snapshot cannot assign an ineligible group head

- **WHEN** a snapshot assigns a viewer or lead user as `headUserId`
- **THEN** validation rejects the restore before the group head write

#### Scenario: a headed user cannot be demoted concurrently

- **WHEN** a user role update and a group-head assignment target the same user
- **THEN** both writes acquire the user lock first
- **AND** the committed state never contains a group headed by a viewer or lead

#### Scenario: a restore validates the final assignment graph before writes

- **GIVEN** a populated target has a current group head and project lead
- **WHEN** one snapshot reassigns the group head or project to another
  snapshot user and demotes or moves the previous owner
- **THEN** restore locks the participating current rows in stable user-first
  order and validates the desired final graph as one unit
- **AND** the restore commits the users, heads, projects, and editable status
  reconciliation atomically without rejecting a valid transient intermediate
  state
- **AND** an invalid final head, lead, activity, or group ownership graph is
  rejected before any restore row is written

Restore's identity and project ownership locks MUST use PostgreSQL `FOR NO KEY
UPDATE` where the transaction does not change the referenced key. A concurrent
parent-first section provision takes `KEY SHARE` locks while inserting its
`ReportSection` and `ProjectStatus` foreign keys; the weaker row lock retains
ownership serialization and remains compatible with those checks, preventing a
User/Report or Project/Report deadlock.

### Requirement: Snapshot restore preserves reminder rule ownership

Admin recovery restore (`saveSnapshot`) MUST write each reminder rule's required
`reportId`, `policyId`, `version`, and immutable schedule basis (`deadline`,
`fireAt`, kind, and timezone) from the supplied snapshot, on both newly-created
and already-existing `ReminderRule` rows. Snapshot validation MUST reject a rule
whose report or policy is absent from the same snapshot before restore starts.
Versions for one report-policy pair MUST be contiguous from 1 through the latest
version, and every superseded version MUST be paused.
When an existing rule may be reparented, restore MUST first discover and lock
both its current source policy and snapshot target policy in canonical order,
then lock the rule and recheck that its current owner belongs to that locked
set. An ownership change to an unlocked policy MUST abort the restore.

#### Scenario: a snapshot import creates a policy-derived rule

- **WHEN** `saveSnapshot` restores a reminder rule that does not yet exist
  in the database, and the snapshot's `policyId` for that rule references a
  policy included in the same snapshot's `policies` array
- **THEN** the created `ReminderRule` row's `policyId` matches the snapshot
  value
- **AND** `getSnapshot` returns that same `policyId` for the rule

#### Scenario: a snapshot restore updates an unexecuted rule's policy linkage

- **WHEN** `saveSnapshot` restores a reminder rule that already exists in
  the database without executions and with a different `policyId` than the
  snapshot supplies
- **THEN** the stored `policyId` is updated to the snapshot's value

#### Scenario: an orphan rule is rejected fail-closed

- **WHEN** a snapshot rule has a missing, null, or cross-linked `reportId` or
  `policyId`
- **THEN** shared snapshot validation rejects it before any database write

#### Scenario: rule ownership changes while recovery acquires locks

- **GIVEN** recovery discovered a rule under policy P1 and intends to restore it
  under policy P2
- **WHEN** the rule resolves to an unowned lock policy P3 after policy locks
- **THEN** restore aborts instead of mutating the rule under an unlocked policy

### Requirement: Snapshot restore keeps policies and versioned rules coherent

An inactive policy MUST own only paused rules. For an active policy, every
superseded version MUST remain paused and only the latest version may be active.
For a live scheduled/open/reopened report, the latest rule's kind, timezone,
immutable deadline, and computed fire time MUST match the current report and
policy. Closed, archived, or deadline-less reports MUST have paused rules but
MAY retain historical schedule identity. Restore MUST reject a contradictory
snapshot before its write transaction. Inside that transaction, an inactive
restored policy MUST pause every retained rule, and an active policy MUST pause
every superseded or stale active retained rule, including rows omitted from the
additive payload. Restore MUST NOT reactivate historical versions.

#### Scenario: a historical version differs from the current policy

- **GIVEN** version 1 owns a sent deadline execution and is paused
- **AND** a report or policy edit produced matching active version 2
- **WHEN** both versions are exported and restored
- **THEN** version 1 retains its original immutable schedule identity
- **AND** version 2 remains the only version eligible to be active

#### Scenario: a version chain or latest live identity is incoherent

- **WHEN** versions have a gap, a superseded version is active, or the latest
  live rule does not match its report and policy schedule facts
- **THEN** snapshot validation rejects the contradiction before restore

#### Scenario: inactive policy restore omits an existing active rule

- **GIVEN** a live active rule references a policy present in the snapshot but
  that rule is omitted from the additive restore payload
- **WHEN** the policy is restored as inactive
- **THEN** the retained live rule becomes paused in the same transaction

#### Scenario: additive restore changes a report while retaining a target-only rule

- **GIVEN** a restored report has an existing reminder rule whose policy is not
  included in the additive snapshot payload
- **WHEN** restore changes the report deadline or lifecycle
- **THEN** restore locks that target policy before any rule mutation and pauses
  the retained rule when its schedule is no longer compatible with the
  restored report and policy
- **AND** the policy and rule reconciliation is atomic with the report restore

### Requirement: Snapshot restore preserves reminder delivery state

The admin snapshot MUST include every persisted `ReminderExecution` with its
identity, rule/report linkage, recipient, dedupe key, lifecycle status,
`sentAt`, error, exact validated `queuePayload`, and persistence
timestamps. Restore MUST upsert executions only after their rules and MUST
preserve `queued`, `sending`, `sent`, and `failed` without reclassifying them.
The queue payload MUST use `contractVersion: 1`; its kind, cycle, deadline, the
execution schedule and report, and the dedupe identity MUST agree with the
referenced immutable snapshot rule version. Those historical facts MUST NOT be
compared to a later mutable Report deadline or latest rule version. Missing or
cross-linked data MUST fail validation before the restore transaction. Additive
restore MUST be monotonic against live
delivery state: an older queued snapshot MUST NOT overwrite an existing
`sending`, `sent`, or `failed` execution. Existing execution identity, dedupe
ownership, creation timestamp, and validated payload are immutable during
restore; any conflict MUST abort the transaction. A rule with retained
executions MUST NOT change `reportId`, `policyId`, version, kind, deadline,
timezone, or `fireAt`, because those fields define every retained execution's
schedule, payload cycle, renderer data, and dedupe key.
`updatedAt` MUST be evaluated before status: older snapshot lifecycle data
never overwrites a newer live row, and equal timestamps with different status
or outcome fields MUST fail as an ambiguous conflict. A newer timestamp is not
authority to reverse delivery ownership: `sending`, `sent`, or `failed` MUST
never transition to queued during recovery; incompatible newer lifecycle data
MUST abort the restore.
Each execution status tuple MUST also be coherent: queued/sending rows carry no
outcome, sent rows require `sentAt` without an error, and failed rows require a
non-empty error without `sentAt`; malformed tuples MUST fail validation before
the restore transaction.

#### Scenario: sent execution survives recovery without duplicate delivery

- **GIVEN** a sent execution captured in an admin snapshot
- **WHEN** its rule and execution are restored into a fresh database state
- **THEN** the sent row keeps its id, dedupe key, status, payload, and timestamps
- **AND** the same reminder request deduplicates without enqueuing another job

#### Scenario: queued execution retains the exact renderer snapshot

- **GIVEN** a queued execution with a validated current-version renderer payload
- **WHEN** the admin snapshot is exported and restored
- **THEN** the restored row remains queued with byte-equivalent payload data
- **AND** its original created and updated timestamps are preserved for reaping

#### Scenario: invalid execution recovery is rejected

- **WHEN** an execution omits its payload, references a rule outside the
  snapshot, or contradicts its rule/report/dedupe identity
- **THEN** snapshot validation fails before the restore transaction starts

#### Scenario: stale queued recovery cannot reopen a live delivery

- **GIVEN** an old snapshot records an execution as queued
- **AND** the live row has advanced to `sending`, `sent`, or `failed`
- **WHEN** the old snapshot is restored
- **THEN** the live lifecycle, outcome, and updated timestamp are retained
- **AND** a sent execution remains deduplicated without another queue job

#### Scenario: live execution identity conflicts with recovery data

- **WHEN** a snapshot execution id or dedupe key resolves to a live row with a
  different rule, recipient, creation timestamp, or validated queue payload
- **THEN** restore fails with a conflict and writes none of the snapshot

#### Scenario: retained executions pin their rule delivery identity

- **GIVEN** a live reminder rule has one or more retained executions
- **WHEN** a snapshot tries to change that rule's owner, version, kind,
  deadline, timezone, or fire time
- **THEN** restore fails with a conflict before the rule is updated

#### Scenario: a sent execution survives a later report schedule edit

- **GIVEN** a sent execution references paused rule version 1 with deadline D1
- **AND** the current report and latest rule version 2 use deadline D2
- **WHEN** the admin snapshot is exported and restored
- **THEN** the execution payload, cycle, and schedule validate against version 1
- **AND** version 2 retains the current report and policy schedule identity

### Requirement: Snapshot restore preserves user active/deactivated status

Admin recovery restore (`saveSnapshot`) MUST write each user's `isActive`
flag from the supplied snapshot, on both newly-created and already-existing
`User` rows.

#### Scenario: a snapshot import creates a deactivated user

- **WHEN** `saveSnapshot` restores a user that does not yet exist in the
  database, and the snapshot's `isActive` for that user is `false`
- **THEN** the created `User` row's `isActive` is `false`
- **AND** `getSnapshot` returns `isActive: false` for that user

#### Scenario: a snapshot restore reactivates an existing user

- **WHEN** `saveSnapshot` restores a user that already exists in the
  database with `isActive: false`, and the snapshot's `isActive` for that
  user is `true`
- **THEN** the stored `isActive` is updated to `true`

#### Scenario: a snapshot restore deactivates an existing user

- **WHEN** `saveSnapshot` restores a user that already exists in the
  database with `isActive: true`, and the snapshot's `isActive` for that
  user is `false`
- **THEN** the stored `isActive` is updated to `false`

# admin-snapshot-restore

## Purpose

Admin whole-database snapshot export/import (`getSnapshot` / `saveSnapshot`).

## Requirements

### Requirement: Snapshot restore applies reporting-group head assignments

Whole-snapshot restore (`saveSnapshot`) MUST write each group's
`headUserId` from the supplied snapshot, on both newly-created and
already-existing `ReportingGroup` rows. The head-assignment write MUST run
only after every user in the snapshot has been upserted, so a group's head
can reference a user created by the same restore. A group with no head in
the snapshot MUST have its stored `headUserId` cleared to `null`.

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

### Requirement: Snapshot restore preserves reminder rule policy linkage

Whole-snapshot restore (`saveSnapshot`) MUST write each reminder rule's
`policyId` from the supplied snapshot, on both newly-created and
already-existing `ReminderRule` rows. A rule with no `policyId` in the
snapshot MUST have its stored `policyId` left as `null`.

#### Scenario: a snapshot import creates a policy-derived rule

- **WHEN** `saveSnapshot` restores a reminder rule that does not yet exist
  in the database, and the snapshot's `policyId` for that rule references a
  policy included in the same snapshot's `reminderPolicies` array
- **THEN** the created `ReminderRule` row's `policyId` matches the snapshot
  value
- **AND** `getSnapshot` returns that same `policyId` for the rule

#### Scenario: a snapshot restore updates an existing rule's policy linkage

- **WHEN** `saveSnapshot` restores a reminder rule that already exists in
  the database with a different `policyId` than the snapshot supplies
- **THEN** the stored `policyId` is updated to the snapshot's value

#### Scenario: a snapshot restore of a policy-less rule stays unlinked

- **WHEN** `saveSnapshot` restores a reminder rule whose snapshot `policyId`
  is `null`
- **THEN** the stored `policyId` remains `null`

### Requirement: Snapshot restore preserves user active/deactivated status

Whole-snapshot restore (`saveSnapshot`) MUST write each user's `isActive`
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

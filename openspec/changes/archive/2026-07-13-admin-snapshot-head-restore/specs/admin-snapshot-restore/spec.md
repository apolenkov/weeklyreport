## ADDED Requirements

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

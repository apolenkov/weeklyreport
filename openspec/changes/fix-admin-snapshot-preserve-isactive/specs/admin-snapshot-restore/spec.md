## ADDED Requirements

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

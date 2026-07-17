## ADDED Requirements

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

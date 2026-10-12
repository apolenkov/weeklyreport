# Spec Delta

## MODIFIED Requirements

### Requirement: Snapshot restore applies reporting-group head assignments

Admin recovery restore (`saveSnapshot`) MUST write each group's
`headUserId` from the supplied snapshot, on both newly-created and
already-existing `ReportingGroup` rows. The head-assignment write MUST run
only after every user in the snapshot has been upserted, so a group's head
can reference a user created by the same restore. A group with no head in
the snapshot MUST have its stored `headUserId` cleared to `null`.

Before assigning a non-null head, restore MUST lock that user row and re-read
the current role and reporting group. The role MUST be `head` or `admin`;
a `head` user MUST have `reportingGroupId` equal to the assigned group id,
while an `admin` user MAY head any number of groups independently of their
reporting group. Restore MUST reject ineligible assignments. Ordinary group
assignments and user role/group updates MUST use the same user-first lock.
Ordinary user updates MUST check every retained headed group and reject any
final role or membership mismatch, including admin-to-head transitions.
Stored head pointers MUST NOT gain a new `isActive` eligibility condition.

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

#### Scenario: an ordinary group assignment rejects a foreign Head

- **WHEN** an ordinary group write assigns a head whose reportingGroupId differs from the target group id
- **THEN** it rejects with CONFLICT after locking that user and leaves the group unchanged
- **AND** matching Head and Admin cross-group assignments remain available

#### Scenario: a headed user cannot move away while retaining the pointer

- **WHEN** an ordinary update moves a Head to another group while their previous group still points to them
- **THEN** it rejects with CONFLICT and leaves the user and head pointer unchanged
- **AND** an Admin may change their own reporting group while retaining cross-group pointers

#### Scenario: an Admin with multiple headings becomes Head

- **GIVEN** an Admin heads two groups and their desired reporting group matches only the first
- **WHEN** an ordinary user update changes their role to head
- **THEN** it checks both headings and rejects the retained foreign pointer without changing any row

#### Scenario: snapshot validation rejects a foreign Head before writes

- **WHEN** a snapshot assigns a head user to a group outside their snapshot reportingGroupId
- **THEN** snapshot validation rejects that pointer before the restore transaction
- **AND** a snapshot Admin may head multiple groups regardless of their reportingGroupId

#### Scenario: restore atomically moves a Head and reassigns or clears the old pointer

- **GIVEN** a current Head is assigned to their own group
- **WHEN** one snapshot moves the Head to another group and clears or reassigns the old head pointer to an eligible user
- **THEN** restore validates the projected final graph and commits all changes atomically
- **AND** it does not reject the transient old pointer before applying the final graph

#### Scenario: restore cannot retain a foreign live heading outside its payload

- **GIVEN** a live group omitted from an additive restore points to an Admin
- **WHEN** the snapshot changes that user to Head of a different included group
- **THEN** the projected final graph rejects the retained foreign pointer before any restore write

#### Scenario: concurrent Head assignment and user transfer preserve membership

- **WHEN** an ordinary Head assignment and that user's group update run concurrently
- **THEN** both serialize on the same user-first lock in either ordering
- **AND** the later incompatible operation rejects without a partial write
- **AND** the committed Head pointer matches the user's reporting group

#### Scenario: inactive stored Head references remain restorable

- **WHEN** a snapshot contains an inactive head user whose reporting group matches their headed group
- **THEN** restore preserves that eligible pointer and inactive state
- **AND** existing inactive-user authorization denial remains unchanged

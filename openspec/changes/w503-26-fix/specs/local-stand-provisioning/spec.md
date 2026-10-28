## ADDED Requirements

### Requirement: Local stand provisioning refuses to change identities outside the fixture set

`deploy/local-prod/provision-users.sql` MUST check the target dataset before its
first write. The run MUST refuse, with a nonzero psql exit and no committed
change, when any `User` row is not one of the four fixture pairs of exact,
case-sensitive `email` and `samlId`, or when any `ReportingGroup` is not the
fixture group. The `User` and `ReportingGroup` tables MUST be locked with
`SHARE ROW EXCLUSIVE` and `NOWAIT` before the check reads them.

#### Scenario: A foreign samlId on a fixture e-mail is refused before any write

- **GIVEN** a `User` row with e-mail `admin@weeklyreport.local`, role `viewer`,
  and a `samlId` other than `admin@weeklyreport.local`
- **WHEN** the operator runs the script with `ON_ERROR_STOP=1`
- **THEN** psql exits nonzero before any `INSERT` or `UPDATE` runs
- **AND** the row keeps role `viewer` and its foreign `samlId`

#### Scenario: A user outside the fixture set is refused

- **GIVEN** a `User` row whose e-mail is not one of the four fixture e-mails
- **WHEN** the operator runs the script
- **THEN** psql exits nonzero before any write
- **AND** no fixture group, fixture user, or head assignment from that run is committed

#### Scenario: A reporting group other than the fixture group is refused

- **GIVEN** a `ReportingGroup` row whose `id` is not the fixture group `id`
- **WHEN** the operator runs the script
- **THEN** psql exits nonzero before any write

#### Scenario: A matching dataset is provisioned and replayed

- **GIVEN** the database has no `User` rows, or only fixture rows whose `samlId`
  equals the fixture pair, and only the fixture group or no group
- **WHEN** the operator runs the script, and later runs it again
- **THEN** the first run commits the group, four users, roles, and head pointer
- **AND** the replay leaves one row per fixture user and keeps the existing head pointer

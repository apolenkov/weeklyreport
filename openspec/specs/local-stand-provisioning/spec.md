# local-stand-provisioning Specification

## Purpose

Define all-or-nothing application of the local stand's reporting group,
user role assignments, and group head pointer through the operator SQL workflow.

## Requirements

### Requirement: Local stand provisioning is atomic

The `deploy/local-prod/provision-users.sql` workflow, consumed through psql stdin
with `ON_ERROR_STOP=1` in `docs/kubernetes.md`, MUST apply its `ReportingGroup`
creation, `User` upsert, and group head assignment as one atomic operation.
If any statement fails, it MUST leave all affected rows as they were before
the run and report a nonzero exit status.

#### Scenario: Late head foreign key failure preserves the pre-run graph

- **GIVEN** an existing head e-mail resolves to a user ID different from the
  script's fixed head ID, which is absent
- **WHEN** the final head assignment fails its foreign key constraint
- **THEN** psql exits nonzero
- **AND** no new reporting group or fixture user remains
- **AND** existing user roles and group assignments equal their pre-run values

#### Scenario: User unique violation preserves the pre-run graph

- **GIVEN** the fixture user upsert encounters an uncovered primary key or
  `samlId` unique violation after the group creation
- **WHEN** the operator runs the script
- **THEN** psql exits nonzero
- **AND** no group creation or user mutation from that run remains

#### Scenario: A valid run commits the complete graph

- **GIVEN** the stand has no conflicting fixture identities or constraints
- **WHEN** the operator runs the script successfully
- **THEN** the group, four fixture users, configured roles and group assignments,
  and the group head pointer are committed together

### Requirement: Sequential replay preserves provisioning relationships

A successful sequential replay of `deploy/local-prod/provision-users.sql`
MUST retain the same fixture user and group identities, roles, group
assignments, and head relationship without adding duplicate rows.
It MUST retain an existing non-null head pointer.

#### Scenario: A valid graph is provisioned again

- **GIVEN** a successful provisioning run
- **WHEN** a later run succeeds with the same fixture identities
- **THEN** there is still one fixture group and one row per fixture user
- **AND** the identities, roles, group assignments, and head pointer are unchanged

#### Scenario: An existing head pointer is retained

- **GIVEN** the fixture group already has a valid non-null head pointer
- **WHEN** provisioning succeeds
- **THEN** that head pointer is retained

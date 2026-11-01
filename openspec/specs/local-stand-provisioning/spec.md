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

### Requirement: Local stand bootstrap admits a matching IdP signing identity

`deploy/local-prod/setup.sh` MUST validate that `idp.crt` and `idp.key` are parseable and share a public key before invoking Kubernetes. It MUST preserve a valid existing pair unchanged and MUST NOT replace an incomplete, malformed, or mismatched existing pair automatically.

#### Scenario: Existing valid identity is reused

- **WHEN** setup runs with a valid matching certificate and private key
- **THEN** both files remain byte-for-byte unchanged
- **AND** setup can continue to Kubernetes

#### Scenario: Invalid or incomplete identity is rejected

- **WHEN** either signing file is missing, malformed, or belongs to a different pair
- **THEN** setup exits nonzero before invoking Kubernetes
- **AND** existing signing files remain unchanged
- **AND** stderr identifies the invalid state without exposing private key bytes or secret values

### Requirement: Local stand bootstrap propagates identity preparation errors

`deploy/local-prod/setup.sh` MUST generate an IdP pair only when both files are absent. A generation or certificate/key conversion failure MUST return a nonzero exit status, expose its diagnostic on stderr, and prevent Kubernetes operations.

#### Scenario: Fresh identity is generated

- **WHEN** neither signing file exists and identity generation succeeds
- **THEN** setup creates a parseable matching pair
- **AND** setup can continue to Kubernetes

#### Scenario: Identity preparation fails

- **WHEN** generation or either conversion fails
- **THEN** setup exits nonzero before invoking Kubernetes
- **AND** the preparation error remains visible on stderr

### Requirement: Local stand bootstrap never publishes partial secrets

`deploy/local-prod/setup.sh` MUST NOT leave a partially generated `secrets.env`
in the state directory when secret generation is interrupted. A following run
MUST generate every required secret before Kubernetes operations. A generated
`secrets.env` MUST have mode `600`.

#### Scenario: Interrupted generation publishes nothing

- **WHEN** secret generation stops before the complete file is written
- **THEN** the state directory contains no `secrets.env`
- **AND** the next run generates every required key before Kubernetes operations

#### Scenario: A missing secret file is generated completely

- **WHEN** the state directory has no `secrets.env`
- **THEN** setup publishes a `secrets.env` with every required key at mode `600`
- **AND** setup continues to Kubernetes operations

#### Scenario: An existing secret file is reused

- **WHEN** `secrets.env` already exists
- **THEN** setup sources it without rewriting its content

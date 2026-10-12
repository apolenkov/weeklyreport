# Spec Delta

## MODIFIED Requirements

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

#### Scenario: An invalid reminder URL returns a validation issue

- **WHEN** admin snapshot validation receives a relative or malformed reminder execution sectionUrl
- **THEN** safe validation returns failure with the existing URL issue at that execution's queuePayload.sectionUrl
- **AND** recovery cross-reference validation does not throw a URL parsing exception
- **AND** valid absolute URLs and mismatched report-id suffixes retain their existing admission behavior

## Purpose

Keep every `Report` lifecycle representation consistent. The canonical
`periodState` machine and the companion lifecycle tuple (`status`,
`periodStatus`, `archived`, audit flags, and applicable timestamps) are stored
on the same row; lifecycle writers update them together in one Prisma
transaction. `periodStart`, `periodEnd`, and nullable `weekLabel` describe the
reporting period and are part of the current report contract, not a second
identity machine.

The transition module is the single field-set source for report lifecycle
writes. Current consumers include period creation and scheduling, publication,
archive/unarchive, snapshot restore, and login-time period materialization.
Lead section saves and carry-over writes modify child rows only.

## Requirements

### Requirement: Lifecycle transitions are atomic

Every code path that mutates a `Report` lifecycle MUST produce the canonical
delta for its transition through
`apps/api/src/modules/period/domain/period-transition.ts` and apply it in the
same Prisma transaction as the guarded write. Creation and restore provide the
full governed field set; other transitions provide the complete delta required
for that transition. The transition MUST keep `periodState`, `status`,
`periodStatus`, `archived`, audit flags, and applicable timestamps consistent.

#### Scenario: Publish updates the complete lifecycle

- **WHEN** the publication path transitions a report to published
- **THEN** `status`, `periodStatus`, `periodState`, publication timestamp, and
  publisher identity are written atomically
- **AND** no committed row contains only a partial lifecycle update

#### Scenario: Reopen preserves distinct state machines

- **WHEN** a published report is reopened
- **THEN** `status` remains `published`, `periodState` becomes `open`, and
  `periodStatus` becomes `reopened` in one transaction
- **AND** the reopen timestamp is written with that transition

### Requirement: All lifecycle writers use the transition module

Period creation, scheduling, publication, archive, unarchive, snapshot restore,
automatic publication, and automatic archive MUST use the transition module's
current transition intents. No writer may hand-assemble governed lifecycle
fields in a repository or scheduler. Lead section save and carry-over are not
Report lifecycle writers and MUST NOT write these fields.

#### Scenario: Child-row writes do not mutate period state

- **WHEN** lead section save or carry-over runs
- **THEN** it writes only its child rows and leaves the owning Report lifecycle
  unchanged

#### Scenario: Snapshot restore restores the captured lifecycle

- **WHEN** an administrator restores a report snapshot
- **THEN** the complete captured lifecycle fields are applied through the
  restore transition in one transaction
- **AND** a reopened report keeps its distinct `status`, `periodState`, and
  `periodStatus` values

### Requirement: Lifecycle writes are guarded against concurrent changes

A lifecycle compare-and-set that follows an authorization or policy read MUST
bind the write to the state that was authorized. Manual publish and period
reopen MUST therefore include the service-read complete lifecycle tuple plus
`periodStart` and `periodEnd` in their update predicate. A concurrent lifecycle
or reporting-envelope change MUST produce a typed stale-state conflict and
preserve the winning transition. A single-statement scheduler or admin state
gate that has no prior authorization read MAY instead use the complete
operation-specific identity defined by its durable specification; it MUST still
fail closed when that identity no longer matches.

#### Scenario: Unarchive loses a race

- **WHEN** another writer changes the report lifecycle after unarchive reads it
- **THEN** the guarded update affects zero rows and returns a stale-state
  conflict without partially changing the report

#### Scenario: Publish authorization becomes stale

- **WHEN** a report lifecycle field or period boundary changes after the
  service authorizes a manual publish but before its guarded write
- **THEN** the exact lifecycle predicate affects zero rows and returns a typed
  stale-state conflict
- **AND** the newer lifecycle transition remains unchanged

### Requirement: Current period payloads are complete and consistent

Current report-period and read-model schemas MUST require the applicable
`periodStart`, `periodEnd`, `weekLabel`, canonical `periodState`, and companion
lifecycle fields. They MUST reject missing or contradictory lifecycle values
instead of manufacturing defaults.

#### Scenario: A contradictory current payload is rejected

- **WHEN** a payload contains incompatible lifecycle fields
- **THEN** shared parsing fails closed before the value reaches a lifecycle
  writer or reader

### Requirement: Lifecycle atomicity has integration coverage

Automated integration coverage MUST verify that a transaction rollback leaves
all lifecycle representations at their prior values and that current writers
produce consistent rows.

#### Scenario: A lifecycle transaction rolls back

- **WHEN** a lifecycle write fails before commit
- **THEN** `periodState` and every companion lifecycle field remain unchanged

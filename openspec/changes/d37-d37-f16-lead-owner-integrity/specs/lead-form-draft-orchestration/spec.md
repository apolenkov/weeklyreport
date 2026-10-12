## ADDED Requirements

### Requirement: Overview edit acknowledgement confirms persisted authored fields

Overview MUST close a submitted edit only after an actual saved response confirms its detached canonical authored fields, identity, placement/parent, section, receipt scope, generation and exact attempt. A version/time bump or an earlier response with different fields MUST NOT acknowledge the edit. Later local changes or activation replacement MUST retain current input.

#### Scenario: An earlier save finishes while the Overview edit is pending

- **WHEN** an earlier payload succeeds but the submitted edit has not persisted
- **THEN** its composer remains open and a later failure retains the submitted input

### Requirement: Failed submitted Overview discard has a guarded persisted disposition

A failed submitted Overview edit/create MUST NOT silently close after local-only restoration. The existing single-flight engine MUST issue an explicit guarded restorative write, even when the committed restored payload equals its saved baseline, or retain detached input/dialog with explicit failure/conflict recovery. Restoration MUST be observed after React commit and MUST include current unrelated edits. Only exact scoped server acknowledgement matching restored fields may close that discard. Conflict MUST NOT automatically retry compensation at a newly read version.

Every persisted intent MUST settle exactly once on success/error, queue replacement/drop, null reconciliation, baseline adoption, activation replacement or disposal. Obsolete/superseded outcomes MUST NOT mutate a new activation. Pending/failed restorative payloads MUST NOT silently retry through ordinary debounce/queue; ordinary unrelated saves and ordinary forceSave semantics remain unchanged.

#### Scenario: Server commits but the save response is lost

- **WHEN** the lead discards that failed submitted edit
- **THEN** equal-baseline restoration attempts an actual CAS-guarded write
- **AND** success closes only its exact restored attempt, while conflict/unknown retains recovery input without claiming rollback

#### Scenario: A queued persisted discard is replaced or disposed

- **WHEN** a newer queue intent, authoritative adoption, activation replacement or unmount invalidates that discard
- **THEN** its waiter settles once as superseded/obsolete and cannot close or mutate a new composer

### Requirement: Overview asynchronous UI state follows target report activation

Overview content MUST isolate pending/running/error ownership by resolved report identity while preserving stable report-keyed input memory. Late results from another report MUST NOT affect current input/error/pending state. Same-report refresh MUST retain composer ownership.

#### Scenario: Warm report B becomes active during report A's command

- **WHEN** the mounted Overview changes A to warm B while A remains pending
- **THEN** B can act without A's pending/error state
- **AND** A's late settlement cannot change B's composer

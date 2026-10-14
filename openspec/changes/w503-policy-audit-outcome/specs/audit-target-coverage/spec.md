## ADDED Requirements

### Requirement: Reminder policy save audit reflects the committed operation

A successful `admin.savePolicy` MUST emit `admin.policy.save` with `action: create` only when that save transaction inserted the policy, and `action: update` when it updated an existing policy. The public response MUST remain the validated policy DTO without internal outcome metadata.

#### Scenario: Concurrent saves target one absent policy

- **WHEN** two successful `admin.savePolicy` calls target the same absent policy without an intervening deletion
- **THEN** their dedicated audit events contain exactly one `create` and one `update`
- **AND** both responses contain only policy fields

#### Scenario: A policy is deleted before the save inserts it

- **WHEN** an existing policy is deleted before a pending save transaction inserts its replacement
- **THEN** the successful save audit reports `create`
- **AND** the returned policy describes the committed replacement

### Requirement: Reminder save conflicts do not emit a success audit

`admin.savePolicy` MUST retry a conflicting policy that disappears before it can be locked within a finite bound. If no policy can be secured within that bound, it MUST return `CONFLICT`, roll back the save and emit no successful `admin.policy.save` event. Ordinary persistence failures MUST retain their existing error classification.

#### Scenario: A conflicting row disappears before locking

- **WHEN** a save encounters an existing policy that is deleted before it can lock that row
- **THEN** a subsequent successful insert reports `create`
- **AND** policy and derived-rule changes commit atomically

#### Scenario: Deletion races exhaust the retry bound

- **WHEN** repeated competing deletions prevent the save from securing a policy within its retry bound
- **THEN** the caller receives `CONFLICT`
- **AND** the save commits no policy or rule changes and emits no successful policy-save event

#### Scenario: Rule reconciliation fails

- **WHEN** derived-rule reconciliation fails during a policy save
- **THEN** all policy and rule changes roll back
- **AND** the failure emits no successful policy-save event

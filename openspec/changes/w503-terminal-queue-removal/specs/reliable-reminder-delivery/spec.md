# Spec Delta

## ADDED Requirements

### Requirement: Terminal reminder replacement preserves the observed job identity

Reminder recovery with `replaceTerminal` MUST remove only a job matching its
captured snapshot while its state is failed or completed in the same atomic
decision. A concurrent retry or changed snapshot under the same stable job id
MUST be preserved. A changed-state or changed-identity outcome MUST
reject replacement before enqueue, preserving the original attempt and context.

#### Scenario: C1358 public retry wins after a terminal recovery read

- **GIVEN** a failed reminder job has valid payload and a real durable execution
- **AND** recovery observed its terminal state and original job identity
- **WHEN** `admin.jobs.retryFailed` legally moves that same job to waiting
- **THEN** stale `replaceTerminal` rejects without removing or replacing it
- **AND** the waiting job retains its original payload, context and attempt history
- **AND** retaining the same id with a newly created job does not count as preservation

#### Scenario: A different terminal job reuses the same execution UUID

- **GIVEN** recovery observed terminal job A under an execution UUID
- **WHEN** A is removed and terminal job B uses that same id before arbitration
- **THEN** recovery preserves B and rejects replacement on changed identity

#### Scenario: The same failed job remains terminal

- **WHEN** the observed job remains failed, unlocked and identity-matching
- **THEN** recovery removes it with native queue cleanup and may enqueue fresh work
- **AND** the durable execution's existing claim guard remains authoritative

#### Scenario: The same completed job remains terminal

- **WHEN** the observed job remains completed, unlocked and identity-matching
- **THEN** recovery may remove it and enqueue the same stable execution id
- **AND** durable sent or in-flight executions are not reopened by queue replacement

#### Scenario: The job is genuinely missing

- **WHEN** initial lookup finds no job or atomic arbitration finds the observed job missing
- **THEN** recovery may enqueue with its existing stable-id deduplication behavior
- **AND** it does not report a successful removal of a job that was absent
- **AND** a job that appears before enqueue is never deleted to force replacement

#### Scenario: The job is already non-terminal or locked

- **WHEN** a waiting, active, delayed or otherwise non-terminal job occupies the id
- **THEN** recovery rejects replacement without deleting or overwriting the job
- **AND** a real worker's active lock remains protected by native queue semantics

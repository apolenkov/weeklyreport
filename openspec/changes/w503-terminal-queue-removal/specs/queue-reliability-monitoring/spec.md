# Spec Delta

## ADDED Requirements

### Requirement: Failed-job removal preserves concurrent retry and identity changes

The `admin.jobs.removeFailed` mutation MUST remove only the caller-observed job
when its current queue state is failed. Eligibility and removal MUST form one
atomic decision across clients. Reuse of the same job id MUST NOT authorize
removing a job whose captured snapshot differs. Waiting, active, delayed and completed jobs
MUST remain intact.

#### Scenario: C0757 public retry wins after the failed-state read

- **GIVEN** a valid failed email-reminder job refers to a real durable execution
- **AND** Remove has read that job's failed state and identity
- **WHEN** `admin.jobs.retryFailed` legally retries it to waiting before Remove commits
- **THEN** the original waiting job and its attempt metadata remain intact
- **AND** Remove returns `removed: false`

#### Scenario: The same id identifies a replacement terminal job

- **GIVEN** Remove observed failed job A
- **WHEN** A disappears and terminal job B with the same id is created before removal
- **THEN** B remains intact because its snapshot identity differs
- **AND** Remove returns `removed: false`

#### Scenario: The observed failed job remains eligible

- **WHEN** the same observed job is still failed and unlocked at atomic removal
- **THEN** Remove deletes it using the queue's native removal semantics
- **AND** Remove returns `removed: true`

#### Scenario: The selected job is absent or was removed by another operation

- **WHEN** the selected job is absent at lookup or disappears before atomic removal
- **THEN** Remove returns `removed: false`
- **AND** absence is not presented as a removal performed by this request

#### Scenario: A worker owns the active job lock

- **GIVEN** a real worker has claimed the observed job and holds its native lock
- **WHEN** a stale failed-job removal resumes
- **THEN** the active job and lock remain intact
- **AND** the action reports no successful removal

### Requirement: Related cleanup preserves domain and generation boundaries

Stale-reminder cleanup through `admin.jobs.retryFailed` MUST use the same atomic
terminal-state and observed-identity rule and MUST report removal only when it
removed that job. PDF retry cleanup MUST target only the caller-selected
superseded generation and preserve newer generations and live queue work. Its
best-effort cleanup failure MUST NOT undo an already committed durable retry.

#### Scenario: A stale-reminder cleanup races with a legal retry

- **GIVEN** stale-reminder cleanup observed a failed entry
- **WHEN** that entry is legally retried to waiting before cleanup commits
- **THEN** cleanup preserves the waiting entry
- **AND** its response does not claim `removed: true`

#### Scenario: A fresh PDF generation already exists

- **GIVEN** a durable PDF retry advanced generation g1 to g2
- **WHEN** superseded-entry cleanup targets g1
- **THEN** g2 remains intact
- **AND** a changed, missing or locked g1 entry cannot undo the durable advance

### Requirement: Dependency-coupled queue removal fails closed

The conditional-removal capability MUST reject an unverified queue-library
version or native removal-script signature before mutation. Revalidation MUST
use the resolved dependency of the delivery tree and its executable script
contract. A mismatch MUST be a loud failure, never a fallback to unconditional
removal. Native lock, scheduler, child and event behavior MUST remain preserved.

#### Scenario: The queue-library version changes

- **WHEN** the resolved queue-library version differs from the reviewed version
- **THEN** the scoped compatibility check fails loudly
- **AND** unverified conditional removal is refused before deleting a job

#### Scenario: The native script changes without a version change

- **WHEN** the compiled removal content, key count or argument signature changes
- **THEN** the compatibility check fails loudly
- **AND** the system does not run a manually reconstructed cleanup or fallback

### Requirement: Add-only queue producers remain narrow

An add-only producer MUST require only enqueue authority. Reminders recovery
MUST consume a separate required conditional-removal capability, without an
optional unconditional-removal fallback. Generic `JobEnqueuer` and unrelated
search consumers MUST retain their existing contracts.

#### Scenario: An add-only PDF producer is composed

- **WHEN** an add-only queue handle is composed for normal PDF enqueue
- **THEN** enqueue works without providing a job-removal capability
- **AND** recovery boundaries still require the checked destructive capability

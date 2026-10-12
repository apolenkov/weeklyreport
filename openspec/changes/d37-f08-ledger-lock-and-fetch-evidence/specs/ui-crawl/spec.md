## ADDED Requirements

### Requirement: Crawler ledger lock failures fail closed

The crawler MUST retry request-ledger lock acquisition only while an existing
lock blocks it. Every other acquisition failure MUST surface with its original
cause instead of retrying forever. Stale-lock cleanup MUST hide only the
released-meanwhile race and MUST surface other filesystem failures. When a
ledger action and its lock release both fail, the action failure MUST remain
primary with the release failure retained as secondary evidence; a standalone
release failure MUST still fail the operation.

#### Scenario: Permanent acquisition failure

- **WHEN** the lock directory cannot be created for a reason other than an existing lock
- **THEN** the operation reports the original filesystem error without waiting for the lock

#### Scenario: Stale lock cannot be removed

- **WHEN** removing an expired lock fails for a reason other than its release
- **THEN** the operation reports that removal failure instead of hiding it

#### Scenario: Action and release both fail

- **WHEN** a locked ledger action fails and releasing the lock also fails
- **THEN** the action failure remains the primary cause and the release failure remains observable

### Requirement: Handled request failures remain observable

The crawler MUST record one bounded page-error diagnostic for a fetch
transport failure even when page code handles the rejection. The diagnostic
MUST name the method and the query- and fragment-free URL, and MUST NOT record
the rejection payload or credentials. The same rejection MUST NOT be reported
again by the global unhandled-rejection listener. The original rejection MUST
reach its caller unchanged, and an ordinary `AbortError` cancellation MUST NOT
be reported as a failure.

#### Scenario: Page code catches a refused request

- **WHEN** a fetch initiated during a press rejects and the page catches it
- **THEN** one page-error entry names the method and stripped URL
- **AND** the caller receives the original rejection and no second report appears

#### Scenario: Intentional cancellation

- **WHEN** a fetch is aborted intentionally
- **THEN** no fetch failure evidence is produced

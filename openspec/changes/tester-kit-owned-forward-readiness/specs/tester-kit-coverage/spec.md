## ADDED Requirements

### Requirement: Tester port-forwards are ready and owned before use

A tester-kit port-forward MUST be reported started only after the process it spawned
listens on the requested local port. A forward that exits or does not listen within the
bound MUST be stopped and reported with its log, and MUST NOT leave a pidfile. Concurrent
starts of the same forward MUST be serialized so that at most one forward runs and its
PID is recorded. Each stand health request MUST be bounded by a per-request timeout.

#### Scenario: The forward dies before listening

- **WHEN** the spawned port-forward exits before it listens
- **THEN** the start fails, names the forward log, and writes no pidfile

#### Scenario: The forward listens after a delay

- **WHEN** the spawned port-forward starts listening after several checks
- **THEN** the start returns only after the owned listener is observed

#### Scenario: Two starts overlap

- **WHEN** two callers start the same forward at once
- **THEN** one forward runs, its PID is recorded, and stopping it leaves no forward alive

#### Scenario: A health request stalls

- **WHEN** a stand health request does not answer
- **THEN** the request ends at its timeout and the readiness loop keeps its bound

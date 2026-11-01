# tester-kit-coverage Specification

## Purpose

Defines how the tester-kit proves coverage of its own scenarios: guarded lifecycle fixtures, per-procedure success evidence, and isolation and reset of the stand between runs.

## Requirements

### Requirement: Procedure coverage counts successful calls

The full-run report MUST list every tRPC procedure of the real router and count
a procedure as exercised only when at least one call ended successfully.
Procedures called only with rejected input or failing handlers MUST be listed as
called but not exercised. Each exercised procedure MUST name where its
successful calls came from: the interface, the synthetic scenario, or both.

#### Scenario: A guard refuses a call

- **WHEN** a procedure is called and the api answers with an error
- **THEN** the report lists it as called and not exercised

### Requirement: Unexercised procedures state their reason

Every procedure that no run exercises MUST carry a specific reason (dev-only,
external call, needs a failed job), kept in a reviewed registry. A procedure
without an entry MUST appear as unclassified, never with a generic reason.

#### Scenario: A new procedure is added

- **WHEN** a new procedure is neither called by the interface nor by the scenario and has no registry entry
- **THEN** the report marks it `unclassified`

### Requirement: Synthetic scenario exercises skipped handlers

The tester-kit MUST provide a synthetic API scenario that runs on a freshly
reset tester stand as the signed-in admin, lead and head, creates the records it
changes (or rewrites existing values with themselves), never calls an outside
host, and records every call with its role, status and whether the step expected
success or refusal. The stand MUST be reset after it.

#### Scenario: The scenario meets a step that needs the outside world

- **WHEN** a step would send a credential or data to an outside provider
- **THEN** the scenario does not run it and the procedure keeps a registry reason

### Requirement: One command starts, runs and reports

`full-run.sh` MUST bring the stand up itself, with the image already deployed
when there is one, whenever it is not running or its collection settings are
off; it MUST then run the quick walk, the full walk, the scenario and the
human-like pass, collect logs and statistics, reset the stand and write
`report.md` with the run time.

#### Scenario: The stand is not running

- **WHEN** `full-run.sh` starts and no api deployment exists
- **THEN** it runs `start.sh` and continues once collection is on

### Requirement: Accepted tester stop bounds namespace deletion waiting

`deploy/tester-kit/stop.sh` MUST use a finite namespace-deletion wait after its context/namespace guard and user confirmation. After a deletion timeout or error it MUST attempt all three port-forward cleanups and return the deletion failure status. Cancellation MUST preserve the namespace and forward records without deletion or cleanup.

#### Scenario: Namespace finalizers prevent deletion completion

- **WHEN** an accepted stop reaches the finite deletion wait limit
- **THEN** it attempts cleanup for app, keycloak, and mailpit forwards
- **AND** it exits with the deletion timeout failure instead of reporting success

#### Scenario: Deletion fails and cleanup also fails

- **WHEN** namespace deletion and a forward cleanup both fail
- **THEN** every forward cleanup is attempted
- **AND** the deletion failure status remains the script exit status

#### Scenario: Operator cancels stop

- **WHEN** the operator declines deletion confirmation
- **THEN** no namespace deletion or forward cleanup is attempted
- **AND** the script exits successfully with a cancellation message

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

# api-shutdown-coordination Specification

## Purpose

Coordinate API termination, fatal-error handling, ordered resource draining,
and one bounded exit outcome.

## Requirements

### Requirement: Process termination shares one drain and exit

API termination signals and fatal error handlers MUST share one shutdown coordinator. Concurrent or repeated requests MUST start the ordered resource drain at most once and request process exit at most once. A fatal error observed before exit MUST make the final exit unsuccessful even when a signal started shutdown first. A successful signal-only drain MUST exit with code 0; a fatal request or failed drain MUST exit with code 1.

#### Scenario: Fatal error arrives during signal shutdown

- **WHEN** signal shutdown has started and a fatal error arrives while the drain is pending
- **THEN** the same drain continues without closing resources twice
- **AND** the coordinator requests exactly one exit with code 1

#### Scenario: Signal arrives during fatal shutdown

- **WHEN** a fatal error starts shutdown and a termination signal arrives while the drain is pending
- **THEN** the signal neither starts another drain nor replaces the fatal exit outcome

#### Scenario: Repeated normal signals complete successfully

- **WHEN** termination signals overlap and the single resource drain succeeds without a fatal error
- **THEN** the coordinator requests exactly one exit with code 0

### Requirement: Fatal termination remains bounded

A fatal request MUST retain the existing five-second terminal deadline. Completion MUST cancel that timer. If the deadline expires first, the coordinator MUST report the timeout and request exit code 1 once; later drain settlement MUST NOT request another exit. The existing ordered API drain and its per-phase deadlines MUST remain intact.

#### Scenario: Fatal drain exceeds its deadline

- **WHEN** the fatal drain remains pending beyond its deadline
- **THEN** the coordinator reports the timeout and requests exit code 1 once
- **AND** later drain settlement does not request another exit

#### Scenario: Fatal drain completes before its deadline

- **WHEN** the fatal drain completes within the deadline
- **THEN** its terminal timer is cancelled and no later timeout is reported

### Requirement: Termination during pending startup drains acquired resources only

Termination signal handlers MUST be registered before the HTTP listen stage,
and the shared shutdown coordinator MUST exist before the first asynchronous
resource-acquisition stage of API bootstrap. A signal or fatal failure during
pending startup MUST run the single ordered drain over exactly the resources
acquired so far. A resource acquired while a drain is already pending MUST be
closed exactly once and MUST NOT be registered for a second close. Startup
MUST NOT log a successful listen or take the success path after a shutdown
request.

#### Scenario: Signal during a pending startup stage

- **WHEN** a termination signal arrives while a startup stage is pending
- **THEN** the drain runs over the resources acquired so far
- **AND** the pending startup neither logs a successful listen nor serves
  traffic
- **AND** the coordinator requests exactly one exit

#### Scenario: Resource acquired while the drain is pending

- **WHEN** a startup stage acquires a resource after the drain already ran
  its placeholder closer
- **THEN** the startup boundary closes that resource exactly once
- **AND** no subsequent close is registered for it

### Requirement: Startup failure requests the shared fatal drain

A failure in any API bootstrap stage after the coordinator exists MUST
request the coordinator's fatal drain instead of bypassing it. The original
startup error MUST remain observable (logged or rethrown at the boundary),
acquired resources MUST still drain in order, and the process MUST exit
unsuccessfully exactly once — no second `process.exit` may race the
coordinator.

#### Scenario: Pipeline stage rejects before listen

- **WHEN** an awaited startup stage rejects after the coordinator exists
- **THEN** the original failure is logged at the startup boundary
- **AND** the fatal drain closes every acquired resource in order
- **AND** the process exits with code 1 exactly once

#### Scenario: Failure before the Nest application exists

- **WHEN** startup fails before the Nest application is created
- **THEN** initialized telemetry drains within a bounded deadline
- **AND** the process exits with code 1 without a second exit request

### Requirement: Nest creation propagates provider-init failures

`NestFactory.create` MUST be called with explicit error propagation
(`abortOnError: false`) so provider-initialization failures reject to the
startup failure boundary rather than aborting the process. When creation or
container logger resolution fails, the pre-bootstrap logger MUST be flushed
once before the failure propagates.

#### Scenario: Provider init failure during Nest creation

- **WHEN** a provider fails during `NestFactory.create`
- **THEN** the create call rejects with the original error
- **AND** the pre-bootstrap logger is flushed once
- **AND** the startup boundary drains acquired resources and telemetry

# Spec Delta

## ADDED Requirements

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

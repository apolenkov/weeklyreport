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

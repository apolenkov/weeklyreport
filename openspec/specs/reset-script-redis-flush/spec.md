# reset-script-redis-flush Specification

## Purpose

Requires a destructive-reset script's Redis flush to settle honestly on the socket-close case rather than mishandling it.

## Requirements

### Requirement: A destructive-reset script's Redis flush settles honestly

Every Prisma maintenance script that flushes Redis as part of a destructive reset MUST settle its flush promise honestly: it MUST resolve success only when a `+OK` reply was actually observed, and it MUST NOT leave the promise permanently unsettled when the socket closes without a reply. A replyless close MUST be reported as a non-fatal, explicit non-success outcome (a rejected promise or an explicit `{flushed:false, reason:...}` result), never silently treated as success and never left hanging past the configured timeout.

#### Scenario: A confirmed flush resolves success

- **GIVEN** the Redis peer replies `+OK` to the flush command
- **WHEN** the flush promise settles
- **THEN** it resolves as a successful flush

#### Scenario: A replyless close does not hang the script

- **GIVEN** the Redis socket closes before any `data` or `error` event fires
- **WHEN** the flush promise settles
- **THEN** it settles promptly (not only via the timeout) as a non-success
  outcome
- **AND** the script's `finally` cleanup ($disconnect, pool.end) still runs

#### Scenario: A replyless close is never reported as "OK"

- **GIVEN** the Redis socket closes before a `+OK` reply is observed
- **WHEN** the flush promise settles
- **THEN** it does not resolve as success
- **AND** the script does not print a success message for that flush

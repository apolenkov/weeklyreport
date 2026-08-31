# reset-script-redis-flush Specification

## Purpose

Requires a destructive-reset script's Redis cleanup to select only the reserved
disposable database and settle honestly on socket-close or protocol errors.

## Requirements

### Requirement: A destructive-reset script's Redis flush settles honestly

Every Prisma maintenance script that cleans Redis as part of a destructive reset MUST require `REDIS_DB=15`, connect only to a loopback endpoint, issue `SELECT 15` and then `FLUSHDB` on the same socket, and settle its promise honestly. It MUST wait for the successful `SELECT 15` reply before sending `FLUSHDB`; the commands MUST NOT be pipelined because a rejected selection could otherwise flush DB 0. It MUST resolve success only after successful replies to both commands have been observed, parse split RESP replies and explicit Redis errors, and MUST NOT leave the promise permanently unsettled when the socket closes without a reply. A replyless close MUST be reported as a non-fatal, explicit non-success outcome (a rejected promise or an explicit `{flushed:false, reason:...}` result), never silently treated as success and never left hanging past the configured timeout. It MUST never issue a server-wide database cleanup command.

#### Scenario: A confirmed flush resolves success

- **GIVEN** the Redis peer replies `+OK` to `SELECT 15` and `FLUSHDB`
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

#### Scenario: Cleanup is scoped to the reserved database

- **GIVEN** `REDIS_DB` is missing or is not exactly `15`
- **WHEN** the reset script starts Redis cleanup
- **THEN** it rejects before opening a Redis socket
- **AND** it does not issue a command to any Redis database

#### Scenario: A failed database selection cannot flush DB 0

- **GIVEN** Redis rejects `SELECT 15`
- **WHEN** the cleanup command handles that reply
- **THEN** it fails closed
- **AND** it never sends `FLUSHDB`

## ADDED Requirements

### Requirement: Backup loop stops promptly on termination signals

`backup-loop.sh` MUST handle SIGTERM and SIGINT, because it runs as PID 1 in the
backup container, where a signal without a handler is ignored. On either signal
it MUST stop the child it is running (`pg_dump` or the loop's interval `sleep`),
remove the partial file of the current pass, and exit without waiting for the
dump to finish: status 143 for SIGTERM and 130 for SIGINT. A dump that has
already been published MUST stay in place.

#### Scenario: SIGTERM arrives during a dump

- **WHEN** the backup process receives SIGTERM while `pg_dump` is running
- **THEN** the process exits 143 within a few seconds without waiting for the dump
- **AND** no `weeklyreport-*` partial file remains in `BACKUP_DIR`

#### Scenario: SIGTERM arrives during the standalone interval

- **WHEN** the standalone loop receives SIGTERM while it sleeps between passes
- **THEN** the process exits 143 without starting another pass

#### Scenario: A signal after publication

- **WHEN** a completed dump has been published and the process then receives SIGTERM
- **THEN** the published `weeklyreport-*.dump` remains in `BACKUP_DIR`

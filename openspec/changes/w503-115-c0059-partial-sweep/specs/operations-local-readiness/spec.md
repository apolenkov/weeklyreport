## ADDED Requirements

### Requirement: Backup start sweeps abandoned partial files under the writer lock

After `backup-loop.sh` acquires the writer lock and before it takes its first
dump, it MUST remove every `weeklyreport-*.partial*` file in `BACKUP_DIR`. Those
files are left by passes that were killed by SIGKILL, lost to a crash or power
failure, or otherwise did not finish. The held lock excludes any live writer, so
no partial file in the directory can belong to an active pass. The sweep MUST
NOT run, and MUST NOT remove any file, when the lock is not acquired. Completed
`weeklyreport-*.dump` files MUST NOT be removed by the sweep, and their
retention MUST keep its current behavior.

#### Scenario: Lock acquired at start

- **WHEN** the backup process acquires the writer lock while stale `weeklyreport-*.partial*` files remain in `BACKUP_DIR`
- **THEN** every such partial file is removed before the first `pg_dump` of the process
- **AND** a completed `weeklyreport-*.dump` within retention remains in `BACKUP_DIR`

#### Scenario: Lock held by another writer

- **WHEN** another backup writer holds the writer lock and the process starts
- **THEN** the process exits 75 without removing any partial file from `BACKUP_DIR`

#### Scenario: Retention of completed dumps is unchanged

- **WHEN** a dump pass completes after the start-time sweep
- **THEN** completed dumps older than the retention window are pruned as before
- **AND** the start-time sweep does not remove any completed dump

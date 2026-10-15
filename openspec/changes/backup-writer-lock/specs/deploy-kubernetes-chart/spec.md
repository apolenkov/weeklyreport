## ADDED Requirements

### Requirement: One backup writer per backup directory

Every `backup-loop.sh` process, in one-shot and standalone mode, MUST take an
exclusive non-blocking `flock` on `$BACKUP_DIR/.backup-writer.lock` before
reserving a temporary file, running `pg_dump` or pruning, and hold it for its
whole lifetime.
When the lock is held, the process MUST log that another backup writer holds
the lock and exit with status 75 without waiting. The lock file MUST NOT be
removed or matched by retention; release MUST rely only on the holder's
descriptors closing.

#### Scenario: A manual Job starts while a backup is running

- **WHEN** a backup writer holds the lock and another `backup-loop.sh` starts on the same directory
- **THEN** the second process exits 75 with the writer-lock message
- **AND** it reserves no temporary file, runs no `pg_dump` and prunes nothing

#### Scenario: The holder is killed

- **WHEN** the process holding the lock is killed and every child that inherited its descriptor has exited
- **THEN** the next writer acquires the lock without any stale-lock cleanup

#### Scenario: Retention runs

- **WHEN** retention prunes dumps older than the configured window
- **THEN** the lock file remains in place

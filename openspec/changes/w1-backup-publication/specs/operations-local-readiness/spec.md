## ADDED Requirements

### Requirement: Backup publication preserves complete dumps across runs

`backup-loop.sh` MUST use a unique temporary file per run and publish completed
dumps under the dated `weeklyreport-*.dump` pattern without replacing an existing
dump. Failure to reserve or publish the file, including a silently skipped
non-clobber move, MUST fail the run without success logging or retention pruning.

#### Scenario: Two one-shot backups share a timestamp

- **WHEN** two `BACKUP_RUN_ONCE=true` runs complete with the same timestamp
- **THEN** two distinct complete dumps remain with both payloads intact
- **AND** each published filename remains discoverable by health and retention

#### Scenario: Publication encounters an existing dump

- **WHEN** the destination already contains a complete dump
- **THEN** the existing dump is preserved and the new run fails
- **AND** the run removes only its own temporary file and does not prune or log success

#### Scenario: Temporary-file reservation fails

- **WHEN** the temporary file cannot be reserved
- **THEN** the run fails without calling pg_dump or pruning retained files

### Requirement: Newly created backup artifacts have private filesystem modes

`backup-loop.sh` MUST apply umask 077 before creating backup artifacts. Newly
created directories MUST have mode 0700 and temporary and complete dump files
MUST have mode 0600. Existing mounted directory permissions MUST remain unchanged.
The existing PGPASSWORD environment contract remains supported.

#### Scenario: A new backup directory is created

- **WHEN** a successful run creates its backup directory
- **THEN** the directory mode is 0700
- **AND** its temporary and completed dump modes are 0600

#### Scenario: A mounted backup directory already exists

- **WHEN** a run uses an existing backup directory with mode 0775
- **THEN** that directory retains mode 0775
- **AND** the run's temporary and completed dumps have mode 0600

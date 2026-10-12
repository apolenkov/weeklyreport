## MODIFIED Requirements

### Requirement: Persistence, backup, and rollout match the stated constraints

PostgreSQL data MUST use a `PGDATA` subdirectory of its mount. Backups MUST run
as a CronJob with `concurrencyPolicy: Forbid`, a required schedule, and a
required retention in days, using the repository backup image and a one-shot
mode of `backup-loop.sh` that exits with the dump's status. The one-shot mode
MUST NOT require `BACKUP_INTERVAL_SECONDS`. The chart MUST NOT claim off-cluster
protection. Backup dumps MUST use the `weeklyreport-*.dump` name pattern; the
chart MUST NOT emit or prune `customreport-*.dump` names.

#### Scenario: One-shot backup

- **WHEN** the CronJob (or a manual job from it) runs
- **THEN** one `weeklyreport-*.dump` is written atomically, older dumps beyond retention are pruned, and the job exits 0
- **AND** a failed `pg_dump` exits non-zero and leaves no restorable-looking partial file

#### Scenario: Standalone backup loop remains available

- **WHEN** `backup-loop.sh` runs without the one-shot variable
- **THEN** it loops at `BACKUP_INTERVAL_SECONDS` as before

# Proposal

## Why

Two successful backups made in the same second can replace the first dump, and
new backup directories inherit a permissive caller mask. TASK-503 C0058 and the
file-mode portions of C0062/C0063 reproduce through the actual one-shot script
with finite synthetic payloads, not a real database.

## What Changes

- Reserve a unique private temporary dump file for each run.
- Publish under the dated `weeklyreport-*.dump` pattern without overwriting an
  existing file; a skipped rename fails without success logging or pruning.
- Create new files and directories with restrictive permissions while preserving
  existing mounted directory modes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operations-local-readiness`: isolate backup temporary files, protect complete
  dumps from replacement and make new-file permissions explicit.

## Impact

`deploy/postgres/backup-loop.sh`, its existing executable filesystem tests and
the backup filename sentence in `docs/operations.md`. Health/retention use
`weeklyreport-*.dump`; restore consumes an explicit path. Evidence:
`wave-01/ops/backup-implementation/filesystem-red.log` under the TASK-503 handoff.

## Non-goals

- Change the accepted PGPASSWORD environment contract or mounted-directory modes.
- Claim production data exposure, image acceptance or a PostgreSQL restore drill.
- Change schedules, retention, image/dependency versions or global configuration.

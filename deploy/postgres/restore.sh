#!/bin/sh
# Restore a pg_dump custom-format backup over an EXISTING database.
#
# This DESTROYS the current contents of $PGDATABASE. It mirrors the discipline
# of prisma/_destructive-guard.ts: the destructive path exists, but it refuses
# to run until the operator names the target out loud.
#
#   docker compose -f docker-compose.prod.yml stop api web
#   docker compose -f docker-compose.prod.yml run --rm \
#     -e CONFIRM_RESTORE_DATABASE=customreport \
#     backup /usr/local/bin/restore.sh /backups/customreport-<stamp>.dump
#   docker compose -f docker-compose.prod.yml start api web
#
# Stop the api first: pg_restore --clean must DROP objects, and an open
# application connection makes that hang or fail halfway, leaving a schema that
# is neither the old one nor the new one.
set -u

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"

export PGHOST PGUSER PGPASSWORD PGDATABASE

dump="${1:-}"

if [ -z "$dump" ]; then
  echo "usage: restore.sh <path-to-dump>" >&2
  exit 2
fi

if [ ! -f "$dump" ]; then
  echo "no such dump: $dump" >&2
  exit 2
fi

if [ "${CONFIRM_RESTORE_DATABASE:-}" != "$PGDATABASE" ]; then
  echo "refusing: set CONFIRM_RESTORE_DATABASE=${PGDATABASE} to confirm" >&2
  echo "this OVERWRITES every table in ${PGDATABASE} on ${PGHOST}" >&2
  exit 3
fi

# Read the archive's table of contents before touching the database: a
# truncated or non-custom-format file fails here, while the existing data is
# still intact.
if ! pg_restore --list "$dump" > /dev/null 2>&1; then
  echo "unreadable archive (truncated, or not pg_dump --format=custom): $dump" >&2
  exit 4
fi

echo "[restore] restoring ${dump} into ${PGDATABASE} on ${PGHOST}"

# --single-transaction so a mid-restore failure rolls back to the pre-restore
# state rather than leaving a half-populated schema. --clean --if-exists makes
# the run idempotent against a database that already has the schema.
pg_restore \
  --dbname="$PGDATABASE" \
  --clean \
  --if-exists \
  --single-transaction \
  --no-owner \
  --no-privileges \
  "$dump"

echo "[restore] done — start the api and verify /health/ready before serving traffic"

#!/bin/sh
# Periodic pg_dump loop for the production stack.
#
# Connects to postgres DIRECTLY, never through pgbouncer: pg_dump holds one
# session across many statements, which transaction-mode pooling breaks.
#
# Every variable is required with no default. A backup cadence and a retention
# window ARE the recovery-point objective — a silent default would invent an
# RPO nobody agreed to and quietly discard history on that schedule.
set -u

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_INTERVAL_SECONDS:?BACKUP_INTERVAL_SECONDS is required}"
: "${BACKUP_RETENTION_DAYS:?BACKUP_RETENTION_DAYS is required}"

export PGHOST PGUSER PGPASSWORD PGDATABASE

log() {
  echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

mkdir -p "$BACKUP_DIR"

log "started: every ${BACKUP_INTERVAL_SECONDS}s, keeping ${BACKUP_RETENTION_DAYS} days, into ${BACKUP_DIR}"

while true; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="${BACKUP_DIR}/customreport-${stamp}.dump"
  partial="${target}.partial"

  # -Fc (custom format) so restores can be selective and parallel; the dump
  # lands under .partial and is renamed only on success, so a crashed or
  # truncated run can never be mistaken for a restorable backup.
  if pg_dump --format=custom --compress=6 --file="$partial" 2>&1; then
    mv "$partial" "$target"
    log "wrote $(basename "$target") ($(wc -c < "$target") bytes)"

    deleted="$(find "$BACKUP_DIR" -name 'customreport-*.dump' -type f \
      -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete | wc -l)"
    if [ "$deleted" -gt 0 ]; then
      log "pruned ${deleted} dump(s) older than ${BACKUP_RETENTION_DAYS} days"
    fi
  else
    # Keep looping instead of exiting: a restart storm would bury the cause in
    # container churn. The staleness healthcheck turns the container red on its
    # own once the newest dump ages past one interval.
    rm -f "$partial"
    log "FAILED — pg_dump did not complete; retrying after the interval"
  fi

  sleep "$BACKUP_INTERVAL_SECONDS"
done

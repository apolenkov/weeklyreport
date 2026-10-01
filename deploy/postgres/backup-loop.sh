#!/bin/sh
# Periodic pg_dump loop for the production stack.
#
# Holds one PostgreSQL session across the complete dump.
#
# Every variable is required with no default. Cadence sets the intended local
# recovery-point interval; retention sets the local history window. A silent
# default would invent either policy and could quietly discard history.
#
# BACKUP_RUN_ONCE=true takes one dump, prunes, and exits with the dump's status
# (a Kubernetes CronJob owns the schedule, so no interval is needed). Any other
# value than true or false is rejected.
set -u

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
run_once="${BACKUP_RUN_ONCE:-false}"
case "$run_once" in
  true|false) ;;
  *)
    echo "BACKUP_RUN_ONCE must be true or false" >&2
    exit 1
    ;;
esac
if [ "$run_once" = false ]; then
  : "${BACKUP_INTERVAL_SECONDS:?BACKUP_INTERVAL_SECONDS is required}"
fi
: "${BACKUP_RETENTION_DAYS:?BACKUP_RETENTION_DAYS is required}"

positive_integer() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
    *[1-9]*)
      [ "${#1}" -le 9 ] || return 1
      return 0
      ;;
    *) return 1 ;;
  esac
}

canonical_decimal() {
  while [ "${1#0}" != "$1" ]; do
    set -- "${1#0}"
  done
  printf '%s\n' "$1"
}

if [ "$run_once" = false ] && ! positive_integer "$BACKUP_INTERVAL_SECONDS"; then
  echo "BACKUP_INTERVAL_SECONDS must be a positive integer with at most 9 digits" >&2
  exit 1
fi
if ! positive_integer "$BACKUP_RETENTION_DAYS"; then
  echo "BACKUP_RETENTION_DAYS must be a positive integer with at most 9 digits" >&2
  exit 1
fi

backup_interval_seconds=""
if [ "$run_once" = false ]; then
  backup_interval_seconds="$(canonical_decimal "$BACKUP_INTERVAL_SECONDS")"
fi
backup_retention_days="$(canonical_decimal "$BACKUP_RETENTION_DAYS")"

export PGHOST PGUSER PGPASSWORD PGDATABASE

log() {
  echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

mkdir -p "$BACKUP_DIR"

if [ "$run_once" = true ]; then
  retry_note=""
  log "started: one run, keeping ${backup_retention_days} days, into ${BACKUP_DIR}"
else
  retry_note="; retrying after the interval"
  log "started: every ${backup_interval_seconds}s, keeping ${backup_retention_days} days, into ${BACKUP_DIR}"
fi

# Returns 0 only when a complete dump was published.
dump_once() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="${BACKUP_DIR}/customreport-${stamp}.dump"
  partial="${target}.partial"

  # -Fc (custom format) so restores can be selective and parallel; the dump
  # lands under .partial and is renamed only on success, so a crashed or
  # truncated run can never be mistaken for a restorable backup.
  if pg_dump --format=custom --compress=6 --file="$partial" 2>&1; then
    if mv "$partial" "$target"; then
      log "wrote $(basename "$target") ($(wc -c < "$target") bytes)"

      deleted="$(find "$BACKUP_DIR" -name 'customreport-*.dump' -type f \
        -mtime "+${backup_retention_days}" -print -delete | wc -l)"
      if [ "$deleted" -gt 0 ]; then
        log "pruned ${deleted} dump(s) older than ${backup_retention_days} days"
      fi
      return 0
    fi
    rm -f "$partial"
    log "FAILED — completed dump could not be published${retry_note}"
    return 1
  fi
  # Keep looping instead of exiting: a restart storm would bury the cause in
  # container churn. The staleness healthcheck turns the container red on its
  # own once the newest dump ages past the two-interval health window.
  rm -f "$partial"
  log "FAILED — pg_dump did not complete${retry_note}"
  return 1
}

if [ "$run_once" = true ]; then
  dump_once
  exit $?
fi

while true; do
  dump_once
  sleep "$backup_interval_seconds"
done

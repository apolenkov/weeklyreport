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
umask 077

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

# This script is PID 1 in the backup container. The kernel gives PID 1 no default
# action for SIGTERM, so without a handler kubelet waits out the grace period and
# SIGKILLs a dump mid-write. Children therefore run in the background and are
# awaited, which lets the trap run at once: stop the child, remove the partial
# this run created, and exit with the conventional signal status.
child_pid=""
current_partial=""
stop_on_signal() {
  if [ -n "$child_pid" ]; then
    kill -TERM "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
    child_pid=""
  fi
  if [ -n "$current_partial" ]; then
    rm -f "$current_partial"
  fi
  log "stopped by signal; exit $1"
  exit "$1"
}
trap 'stop_on_signal 143' TERM
trap 'stop_on_signal 130' INT

mkdir -p "$BACKUP_DIR"

# One writer per backup directory for the whole process: the CronJob, a manual
# Job and the standalone loop share this volume, and Forbid serializes only the
# first. The kernel drops the lock when the shell and every child holding fd 9
# have exited, so no stale-lock cleanup exists; pg_dump inherits fd 9 on purpose
# and keeps its partial protected until it exits. The lock file is never removed.
writer_lock="${BACKUP_DIR}/.backup-writer.lock"
exec 9>>"$writer_lock"
if ! flock -n 9; then
  log "FAILED — another backup writer holds ${writer_lock} (or flock failed above); not waiting"
  exit 75
fi

# Holding the lock excludes every live writer, so a partial left in the directory
# was abandoned by a killed or crashed pass and is safe to remove before any dump.
swept=0
for abandoned in "${BACKUP_DIR}"/weeklyreport-*.partial*; do
  [ -f "$abandoned" ] || continue
  rm -f "$abandoned"
  swept=$((swept + 1))
done
log "swept ${swept} abandoned partial file(s) under the writer lock"

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
  if ! partial="$(mktemp "${BACKUP_DIR}/weeklyreport-${stamp}.partial.XXXXXX")"; then
    log "FAILED — temporary dump file could not be reserved${retry_note}"
    return 1
  fi
  target="${BACKUP_DIR}/weeklyreport-${stamp}-${partial##*.}.dump"
  current_partial="$partial"

  # -Fc (custom format) so restores can be selective and parallel; the dump
  # lands in its own private partial and is renamed only on success, so a crashed or
  # truncated run can never be mistaken for a restorable backup.
  pg_dump --format=custom --compress=6 --file="$partial" 2>&1 &
  child_pid=$!
  wait "$child_pid"
  dump_status=$?
  child_pid=""
  if [ "$dump_status" -eq 0 ]; then
    # mv -n can return success after skipping an existing destination.
    if mv -n "$partial" "$target" && [ ! -e "$partial" ]; then
      log "wrote $(basename "$target") ($(wc -c < "$target") bytes)"

      deleted="$(find "$BACKUP_DIR" -name 'weeklyreport-*.dump' -type f \
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
  # sleep must not inherit the lock: an orphaned sleep would hold it a whole interval.
  # It runs in the background so a TERM is handled without waiting out the interval.
  sleep "$backup_interval_seconds" 9>&- &
  child_pid=$!
  wait "$child_pid"
  child_pid=""
done

#!/bin/sh
# Healthcheck for the backup service: the container is healthy only while a
# RECENT dump exists. A process that is merely alive proves nothing — the
# failure mode worth catching is a loop that keeps running while every pg_dump
# fails, which looks identical from the outside until a restore is attempted.
#
# Tolerance is two intervals: one missed cycle is a transient, two is a trend.
set -u

: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_INTERVAL_SECONDS:?BACKUP_INTERVAL_SECONDS is required}"

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

if ! positive_integer "$BACKUP_INTERVAL_SECONDS"; then
  echo "BACKUP_INTERVAL_SECONDS must be a positive integer with at most 9 digits" >&2
  exit 1
fi

backup_interval_seconds="$(canonical_decimal "$BACKUP_INTERVAL_SECONDS")"

# busybox find has -mmin but not -newermt; round the window up so a dump that
# lands mid-minute is never judged stale by rounding alone.
window_minutes=$(((backup_interval_seconds * 2 + 59) / 60))

fresh="$(find "$BACKUP_DIR" -name 'customreport-*.dump' -type f \
  -mmin "-${window_minutes}" 2>/dev/null | head -n 1)"

if [ -z "$fresh" ]; then
  echo "no dump newer than ${window_minutes}m in ${BACKUP_DIR}"
  exit 1
fi

exit 0

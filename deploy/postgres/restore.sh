#!/bin/sh
# Restore a pg_dump custom-format archive over one explicitly named database.
set -eu

required() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "refusing: $name is required" >&2
    exit 2
  fi
}

canonical_word() {
  value="$1"
  label="$2"
  case "$value" in
    *[!A-Za-z0-9_-]* | "")
      echo "refusing: invalid $label" >&2
      exit 2
      ;;
  esac
  printf '%s' "$value" | tr '[:upper:]' '[:lower:]'
}

canonical_host() {
  value="$1"
  case "$value" in
    *[!A-Za-z0-9.-]* | "" | -* | *- | .* | *..*)
      echo "refusing: invalid PGHOST" >&2
      exit 2
      ;;
  esac
  canonical=$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')
  printf '%s' "${canonical%.}"
}

required RESTORE_ENVIRONMENT
required PGHOST
required PGPORT
required PGUSER
required PGPASSWORD
required PGDATABASE

environment=$(canonical_word "$RESTORE_ENVIRONMENT" RESTORE_ENVIRONMENT)
host=$(canonical_host "$PGHOST")
database=$(canonical_word "$PGDATABASE" PGDATABASE)

case "$PGPORT" in
  *[!0-9]* | "")
    echo "refusing: invalid PGPORT" >&2
    exit 2
    ;;
esac
if [ "$PGPORT" -lt 1 ] || [ "$PGPORT" -gt 65535 ]; then
  echo "refusing: invalid PGPORT" >&2
  exit 2
fi
port="$PGPORT"

case "$environment" in
  test | production) ;;
  *)
    echo "refusing: unknown RESTORE_ENVIRONMENT" >&2
    exit 2
    ;;
esac

export PGHOST="$host" PGPORT="$port" PGUSER PGPASSWORD PGDATABASE="$database"
target="${environment}|${host}|${port}|${database}"
dump="${1:-}"
restore_bin="${PG_RESTORE_BIN:-pg_restore}"

if [ -z "$dump" ] || [ ! -f "$dump" ]; then
  echo "usage: restore.sh <existing-path-to-dump>" >&2
  exit 2
fi

if [ "${CONFIRM_RESTORE_TARGET:-}" != "$target" ]; then
  echo "refusing: set CONFIRM_RESTORE_TARGET=${target}" >&2
  exit 3
fi

if [ "${PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION:-}" != "давай" ]; then
  echo "refusing: restore requires explicit per-run destructive consent" >&2
  exit 3
fi

if [ "$environment" = "production" ] &&
  [ "${ALLOW_PROD_DESTRUCTIVE:-}" != "yes" ]; then
  echo "refusing: production restore requires ALLOW_PROD_DESTRUCTIVE=yes" >&2
  exit 3
fi

if ! "$restore_bin" --list -- "$dump" > /dev/null 2>&1; then
  echo "refusing: unreadable pg_dump custom-format archive" >&2
  exit 4
fi

echo "[restore] target=${target} archive=${dump}"
"$restore_bin" \
  --host="$host" \
  --port="$port" \
  --username="$PGUSER" \
  --dbname="$database" \
  --clean \
  --if-exists \
  --single-transaction \
  --no-owner \
  --no-privileges \
  -- "$dump"
echo "[restore] complete; verify /health/ready before serving traffic"

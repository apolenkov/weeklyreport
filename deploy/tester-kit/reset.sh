#!/usr/bin/env bash
# Guarded reset of the synthetic tester stand; optional verified crawl overlay.
# reset.sh [--yes] [--crawl-state <state> --manifest <file>]
set -euo pipefail
. "$(dirname "$0")/env.sh"
. "$HERE/guard.sh"

YES=0
CRAWL_STATE=""
MANIFEST=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) YES=1; shift ;;
    --crawl-state) CRAWL_STATE=${2:?state required}; shift 2 ;;
    --manifest) MANIFEST=${2:?manifest path required}; shift 2 ;;
    *) echo "Unknown reset argument: $1" >&2; exit 2 ;;
  esac
done
if [ -n "$CRAWL_STATE" ]; then
  case "$CRAWL_STATE" in draft|submitted|returned|published|archived|closed|reopened) ;; *) echo "Unknown crawl state" >&2; exit 2 ;; esac
  [ -n "$MANIFEST" ] || { echo "--crawl-state needs --manifest" >&2; exit 2; }
elif [ -n "$MANIFEST" ]; then
  echo "--manifest needs --crawl-state" >&2; exit 2
fi

tester_guard
if [ "$YES" != 1 ]; then
  read -r -p "Wipe the database in $NS and reseed demo data? (yes/no): " ans
  [ "$ans" = yes ] || { echo Cancelled; exit 0; }
fi
tester_lock
PF=""
REDIS_PF=""
STOPPED=0
BACKUPS_SUSPENDED=0
cleanup() {
  local result=$?
  trap - EXIT
  [ -z "$PF" ] || kill "$PF" 2>/dev/null || true
  [ -z "$REDIS_PF" ] || kill "$REDIS_PF" 2>/dev/null || true
  if [ "$STOPPED" = 1 ]; then
    kubectl -n "$NS" scale deploy/api --replicas="$ORIGINAL_REPLICAS" >/dev/null || result=1
    if [ "$ORIGINAL_REPLICAS" != 0 ]; then
      kubectl -n "$NS" rollout status deploy/api --timeout=300s || result=1
    fi
  fi
  if [ "$BACKUPS_SUSPENDED" = 1 ] && [ "$ORIGINAL_BACKUP_SUSPEND" != true ]; then
    kubectl -n "$NS" patch cronjob/backup --type=merge -p '{"spec":{"suspend":false}}' >/dev/null || result=1
  fi
  tester_unlock || result=1
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

set -a; . "$STATE_DIR/secrets.env"; set +a
[ -n "${DB_PASSWORD:-}" ] || { echo "Missing required secret: DB_PASSWORD" >&2; exit 1; }
if ! ORIGINAL_REPLICAS=$(kubectl -n "$NS" get deploy/api -o jsonpath='{.spec.replicas}'); then
  echo "Could not read API replica count; refusing reset." >&2
  exit 1
fi
case "$ORIGINAL_REPLICAS" in ''|*[!0-9]*) echo "Invalid API replica count; refusing reset." >&2; exit 1 ;; esac
# The tester backup CronJob dumps weeklyreport_e2e; keep it off the database while it is reset.
if ! ORIGINAL_BACKUP_SUSPEND=$(kubectl -n "$NS" get cronjob/backup -o jsonpath='{.spec.suspend}'); then
  echo "Could not read backup CronJob suspension; refusing reset." >&2
  exit 1
fi
case "$ORIGINAL_BACKUP_SUSPEND" in true|false|'') ;; *) echo "Invalid backup CronJob suspension; refusing reset." >&2; exit 1 ;; esac
BACKUPS_SUSPENDED=1
kubectl -n "$NS" patch cronjob/backup --type=merge -p '{"spec":{"suspend":true}}' >/dev/null
# Suspension does not stop a running backup Job; wait up to 10 minutes for it to finish.
for _ in $(seq 1 120); do
  ACTIVE_BACKUPS=$(kubectl -n "$NS" get pods -l app.kubernetes.io/component=backup \
    --field-selector=status.phase!=Succeeded,status.phase!=Failed -o name)
  [ -n "$ACTIVE_BACKUPS" ] || break
  sleep 5
done
[ -z "$ACTIVE_BACKUPS" ] || { echo "A backup is still running; refusing reset: $ACTIVE_BACKUPS" >&2; exit 1; }
PG_PF_LOG="$STATE_DIR/pf-reset-postgres.log"
REDIS_PF_LOG="$STATE_DIR/pf-reset-redis.log"
(umask 077; : >"$PG_PF_LOG"; : >"$REDIS_PF_LOG"; chmod 600 "$PG_PF_LOG" "$REDIS_PF_LOG")
PGPORT_LOCAL=55432
REDISPORT_LOCAL=56379
for port in "$PGPORT_LOCAL" "$REDISPORT_LOCAL"; do
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $port is busy." >&2; exit 1; fi
done
export DATABASE_URL="postgresql://weeklyreport:${DB_PASSWORD}@127.0.0.1:$PGPORT_LOCAL/weeklyreport_e2e"
export E2E_AI_PROVIDER_API_KEY=""
export PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'
export REDIS_HOST=127.0.0.1 REDIS_PORT=$REDISPORT_LOCAL REDIS_DB=15
cd "$REPO"
[ -d node_modules ] || pnpm install --frozen-lockfile
pnpm --filter @weeklyreport/api db:generate >/dev/null
echo "Target: postgresql://***@127.0.0.1:$PGPORT_LOCAL/weeklyreport_e2e; Redis DB 15"
pnpm exec tsx -e 'import { assertE2eRuntimeDestructive } from "./prisma/guards/_destructive-guard.ts"; assertE2eRuntimeDestructive("tester-reset")'
# Observability hook (full-run.sh): collect api coverage, logs and database statistics before they are wiped.
[ -z "${WR_PRE_RESET_HOOK:-}" ] || bash -c "$WR_PRE_RESET_HOOK"
STOPPED=1
kubectl -n "$NS" scale deploy/api --replicas=0 >/dev/null
kubectl -n "$NS" wait --for=delete pod -l app.kubernetes.io/component=api --timeout=120s
kubectl -n "$NS" port-forward --address 127.0.0.1 svc/postgres "$PGPORT_LOCAL:5432" >"$PG_PF_LOG" 2>&1 &
PF=$!
kubectl -n "$NS" port-forward --address 127.0.0.1 svc/redis "$REDISPORT_LOCAL:6379" >"$REDIS_PF_LOG" 2>&1 &
REDIS_PF=$!
for port in "$PGPORT_LOCAL" "$REDISPORT_LOCAL"; do
  for _ in $(seq 1 30); do lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && break; sleep 1; done
  lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || { if [ "$port" = "$PGPORT_LOCAL" ]; then
      echo "postgres port-forward did not start: $port; see $PG_PF_LOG" >&2
    else
      echo "redis port-forward did not start: $port; see $REDIS_PF_LOG" >&2
    fi
    exit 1; }
done
pnpm exec tsx prisma/operations/migrate-reset.ts
if [ -n "$CRAWL_STATE" ]; then
  pnpm exec tsx prisma/seeds/fixtures/ui-crawl-state.ts "$CRAWL_STATE" --manifest "$MANIFEST"
else
  (cd apps/api && pnpm exec tsx ../../prisma/seeds/profiles/seed-profile.ts full)
fi
kubectl -n "$NS" exec -i statefulset/postgres -- psql -U weeklyreport -d weeklyreport_e2e -v ON_ERROR_STOP=1 <"$HERE/post-seed.sql"
[ -z "${WR_POST_RESET_HOOK:-}" ] || bash -c "$WR_POST_RESET_HOOK"
pnpm exec tsx -e 'import { flushRedis } from "./prisma/operations/reset-hard.ts"; void flushRedis()'
echo "Demo data reset."

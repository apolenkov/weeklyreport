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
cleanup() {
  local result=$?
  trap - EXIT
  [ -z "$PF" ] || kill "$PF" 2>/dev/null || true
  [ -z "$REDIS_PF" ] || kill "$REDIS_PF" 2>/dev/null || true
  if [ "$STOPPED" = 1 ]; then
    kubectl -n "$NS" scale deploy/api --replicas=1 >/dev/null || result=1
    kubectl -n "$NS" rollout status deploy/api --timeout=300s || result=1
  fi
  tester_unlock || result=1
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

set -a; . "$STATE_DIR/secrets.env"; set +a
PGPORT_LOCAL=55432
REDISPORT_LOCAL=56379
for port in "$PGPORT_LOCAL" "$REDISPORT_LOCAL"; do
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $port is busy." >&2; exit 1; fi
done
export DATABASE_URL="postgresql://customreport:${DB_PASSWORD}@127.0.0.1:$PGPORT_LOCAL/customreport_e2e"
export E2E_AI_PROVIDER_API_KEY=""
export PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'
export REDIS_HOST=127.0.0.1 REDIS_PORT=$REDISPORT_LOCAL REDIS_DB=15
cd "$REPO"
[ -d node_modules ] || pnpm install --frozen-lockfile
pnpm --filter @customreport/api db:generate >/dev/null
echo "Target: postgresql://***@127.0.0.1:$PGPORT_LOCAL/customreport_e2e; Redis DB 15"
pnpm exec tsx -e 'import { assertE2eRuntimeDestructive } from "./prisma/guards/_destructive-guard.ts"; assertE2eRuntimeDestructive("tester-reset")'
kubectl -n "$NS" scale deploy/api --replicas=0 >/dev/null
STOPPED=1
kubectl -n "$NS" wait --for=delete pod -l app=api --timeout=120s
kubectl -n "$NS" port-forward --address 127.0.0.1 svc/postgres "$PGPORT_LOCAL:5432" >/dev/null 2>&1 &
PF=$!
kubectl -n "$NS" port-forward --address 127.0.0.1 svc/redis "$REDISPORT_LOCAL:6379" >/dev/null 2>&1 &
REDIS_PF=$!
for port in "$PGPORT_LOCAL" "$REDISPORT_LOCAL"; do
  for _ in $(seq 1 30); do lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && break; sleep 1; done
  lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || { echo "Port-forward did not start: $port" >&2; exit 1; }
done
pnpm exec tsx prisma/operations/migrate-reset.ts
if [ -n "$CRAWL_STATE" ]; then
  pnpm exec tsx prisma/seeds/fixtures/ui-crawl-state.ts "$CRAWL_STATE" --manifest "$MANIFEST"
else
  (cd apps/api && pnpm exec tsx ../../prisma/seeds/profiles/seed-profile.ts full)
fi
kubectl -n "$NS" exec -i statefulset/postgres -- psql -U customreport -d customreport_e2e -v ON_ERROR_STOP=1 <"$HERE/post-seed.sql"
pnpm exec tsx -e 'import { flushRedis } from "./prisma/operations/reset-hard.ts"; void flushRedis()'
echo "Demo data reset."

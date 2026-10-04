#!/usr/bin/env bash
# Reset the stand database: drop, migrate, seed the "full" demo profile, map the
# four SAML users. Needs a repository checkout with Node and pnpm (the images carry
# no seed tooling). The target is the cluster database customreport_e2e, reached through
# a loopback port-forward and accepted by the repository destructive guard.
#   reset.sh [--yes]
set -euo pipefail
. "$(dirname "$0")/env.sh"

kubectl get namespace "$NS" >/dev/null 2>&1 || { echo "Namespace $NS not found. Run start.sh first." >&2; exit 1; }
if [ "${1:-}" != --yes ]; then
  read -r -p "Wipe the database in $NS and reseed demo data? (yes/no): " ans
  [ "$ans" = yes ] || { echo Cancelled; exit 0; }
fi

set -a; . "$STATE_DIR/secrets.env"; set +a
PGPORT_LOCAL=55432
lsof -iTCP:$PGPORT_LOCAL -sTCP:LISTEN >/dev/null 2>&1 && { echo "Port $PGPORT_LOCAL is busy." >&2; exit 1; }
kubectl -n "$NS" scale deploy/api --replicas=0 >/dev/null
kubectl -n "$NS" wait --for=delete pod -l app=api --timeout=120s >/dev/null 2>&1 || true
kubectl -n "$NS" port-forward --address 127.0.0.1 svc/postgres "$PGPORT_LOCAL:5432" >/dev/null 2>&1 &
PF=$!
trap 'kill $PF 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do lsof -iTCP:$PGPORT_LOCAL -sTCP:LISTEN >/dev/null 2>&1 && break; sleep 1; done

export DATABASE_URL="postgresql://customreport:${DB_PASSWORD}@127.0.0.1:$PGPORT_LOCAL/customreport_e2e"
# The tester DB must not inherit an AI provider key from a developer .env.
export E2E_AI_PROVIDER_API_KEY=""
export PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'
cd "$REPO"
[ -d node_modules ] || pnpm install --frozen-lockfile
pnpm --filter @customreport/api db:generate >/dev/null
echo "Target: postgresql://***@127.0.0.1:$PGPORT_LOCAL/customreport_e2e"
pnpm exec tsx prisma/operations/migrate-reset.ts
(cd apps/api && pnpm exec tsx ../../prisma/seeds/profiles/seed-profile.ts full)
kubectl -n "$NS" exec -i statefulset/postgres -- psql -U customreport -d customreport_e2e -v ON_ERROR_STOP=1 \
  <"$HERE/post-seed.sql"
kubectl -n "$NS" exec statefulset/redis -- redis-cli FLUSHDB >/dev/null
kubectl -n "$NS" scale deploy/api --replicas=1 >/dev/null
kubectl -n "$NS" rollout status deploy/api --timeout=300s
echo "Demo data reset."

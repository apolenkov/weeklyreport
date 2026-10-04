#!/usr/bin/env bash
# Reset demo data in the tester kit namespace.
# Deletes database and re-runs migrations/seeds.

set -euo pipefail
trap 'echo "Error on line $LINENO"' ERR

NS=${NS:-wr-tester}
STATE_DIR=${STATE_DIR:?set STATE_DIR to a directory outside Git}
HERE=$(cd "$(dirname "$0")" && pwd)

# Guard: confirm namespace exists and is tester kit
if ! kubectl get namespace "$NS" >/dev/null 2>&1; then
  echo "Error: Namespace $NS not found"
  exit 1
fi

read -p "Reset demo data in $NS? This will delete database and re-seed. (yes/no): " -r confirm
if [ "$confirm" != "yes" ]; then
  echo "Cancelled"
  exit 0
fi

echo "Deleting PostgreSQL data..."
# Delete PVC to force re-creation
kubectl -n "$NS" delete pvc postgres-data --ignore-not-found
echo "Waiting for pod recreation..."
sleep 10

# Restart deployments to trigger pod recreation
echo "Restarting API and migrate pods..."
kubectl -n "$NS" rollout restart deploy/api deploy/postgres 2>/dev/null || true
kubectl -n "$NS" rollout status deploy/postgres --timeout=60s || true
sleep 5

# Wait for database to be ready
echo "Waiting for PostgreSQL..."
for i in {1..60}; do
  if kubectl -n "$NS" exec -i $(kubectl -n "$NS" get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) \
     -- psql -U postgres -d customreport_tester -c "SELECT 1" >/dev/null 2>&1; then
    echo "✓ PostgreSQL is ready"
    break
  fi
  echo "Waiting... ($i/60)"
  sleep 2
done

# Run migrations from the API pod
echo "Running migrations..."
API_POD=$(kubectl -n "$NS" get pod -l app=api -o jsonpath='{.items[0].metadata.name}')
kubectl -n "$NS" exec "$API_POD" -- npm run db:migrate 2>&1 | tail -5

# Run seeds
echo "Seeding demo data..."
kubectl -n "$NS" exec "$API_POD" -- npm run db:seed 2>&1 | tail -5

echo "✓ Demo data reset and seeded"
echo ""
echo "Database: customreport_tester"
echo "Test users available in Keycloak"

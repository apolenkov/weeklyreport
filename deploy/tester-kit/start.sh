#!/usr/bin/env bash
# Start the tester stand in the local Kubernetes cluster (namespace wr-tester).
#   start.sh [--tag <git-sha>] [--registry <repo-prefix>] [--local]
# --local uses wr/* images already built on this machine (tag defaults to the newest one).
# Registry login, if the registry needs it: REGISTRY_USER=... REGISTRY_PASSWORD=... start.sh
set -euo pipefail
. "$(dirname "$0")/env.sh"

REGISTRY=registry.example.com:5005/example/weeklyreport
TAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG=${2:?--tag needs a value}; shift 2 ;;
    --registry) REGISTRY=${2:?--registry needs a value}; shift 2 ;;
    --local) REGISTRY=wr; shift ;;
    *) echo "Usage: $0 [--tag <sha>] [--registry <prefix>] [--local]" >&2; exit 2 ;;
  esac
done

for tool in kubectl helm openssl envsubst curl lsof pnpm; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool (see README.md)" >&2; exit 1; }
done
CTX=$(kubectl config current-context)
case "$CTX" in
  orbstack | docker-desktop) ;;
  *) echo "Kubernetes context is '$CTX', not a local one (orbstack, docker-desktop)." >&2
     echo "Switch with: kubectl config use-context orbstack   (or docker-desktop)" >&2
     exit 1 ;;
esac
kubectl cluster-info >/dev/null 2>&1 || { echo "Cluster '$CTX' is not reachable. Start Kubernetes first." >&2; exit 1; }

if [ -z "$TAG" ]; then
  if [ "$REGISTRY" = wr ]; then
    TAG=$(docker images wr/api --format '{{.Tag}}' | head -n1)
  else
    TAG=$(git -C "$REPO" rev-parse HEAD)
  fi
fi
[ -n "$TAG" ] || { echo "No image tag: pass --tag <git-sha>." >&2; exit 1; }
echo "Context: $CTX | namespace: $NS | images: $REGISTRY/*:$TAG"

bash "$HERE/setup.sh"

PULL_ARGS=()
if [ -n "${REGISTRY_USER:-}" ]; then
  kubectl -n "$NS" create secret docker-registry regcred --docker-server="${REGISTRY%%/*}" \
    --docker-username="$REGISTRY_USER" --docker-password="${REGISTRY_PASSWORD:?set REGISTRY_PASSWORD}" \
    --dry-run=client -o yaml | kubectl apply -f -
  PULL_ARGS=(--set images.pullSecret=regcred)
fi

helm upgrade --install weeklyreport "$REPO/deploy/helm/weeklyreport" -n "$NS" \
  -f "$HERE/values-tester.yaml" \
  --set "images.registry=$REGISTRY" --set "images.tag=$TAG" "${PULL_ARGS[@]}" \
  --set-string "api.env.KEYCLOAK_SAML_CERT=$(cat "$STATE_DIR/idp-cert.b64")" \
  --wait --timeout 10m

pf_start app edge "$APP_PORT" 8080
pf_start keycloak keycloak "$KC_PORT" 8080
pf_start mailpit mailpit "$MAIL_PORT" 8025

# First start: the schema is migrated by the api pod, demo data and roles are loaded here.
if [ "$(kubectl -n "$NS" exec statefulset/postgres -- psql -U customreport -d customreport_e2e -Atc \
  'SELECT count(*) FROM "User"' 2>/dev/null || echo 0)" = 0 ]; then
  bash "$HERE/reset.sh" --yes
fi

for _ in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$APP_PORT/health/ready")" = 200 ] && break
  sleep 2
done
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$APP_PORT/health/ready")" = 200 ] \
  || { echo "/health/ready is not 200. See: kubectl -n $NS logs deploy/api" >&2; exit 1; }

set -a; . "$STATE_DIR/secrets.env"; set +a
cat <<OUT

WeeklyReport is ready: /health/ready = 200
  App        http://localhost:$APP_PORT   (sign in with SAML)
  Mailpit    http://localhost:$MAIL_PORT   (all e-mails)
  Keycloak   http://localhost:$KC_PORT   (admin / password in $STATE_DIR/secrets.env)
Users (password):
  lead1@customreport.local    $PW_LEAD1   (lead)
  head@customreport.local     $PW_HEAD   (head)
  viewer@customreport.local   $PW_VIEWER   (viewer)
  admin@customreport.local    $PW_ADMIN   (admin)
Reset data: reset.sh | stop: stop.sh
OUT

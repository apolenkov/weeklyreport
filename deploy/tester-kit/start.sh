#!/usr/bin/env bash
# Start the tester stand in the local Kubernetes cluster (namespace wr-tester).
#   start.sh [--tag <git-sha>] [--registry <repo-prefix>]
# Uses wr/* images built on this machine by build-images.sh (tag defaults to the newest one).
# --registry <prefix> pulls from a registry instead; login: REGISTRY_USER=... REGISTRY_PASSWORD=...
set -euo pipefail
. "$(dirname "$0")/env.sh"

REGISTRY=wr
TAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG=${2:?--tag needs a value}; shift 2 ;;
    --registry) REGISTRY=${2:?--registry needs a value}; shift 2 ;;
    *) echo "Usage: $0 [--tag <sha>] [--registry <prefix>]" >&2; exit 2 ;;
  esac
done

for tool in kubectl helm openssl envsubst curl lsof pnpm node; do
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
[ -n "$TAG" ] || { echo "No wr/* images on this machine: run deploy/tester-kit/build-images.sh first." >&2; exit 1; }
if [ "$REGISTRY" = wr ]; then
  for image in api migrate web backup; do
    docker image inspect "wr/$image:$TAG" >/dev/null 2>&1 \
      || { echo "Image wr/$image:$TAG is missing: run deploy/tester-kit/build-images.sh --tag $TAG." >&2; exit 1; }
  done
fi
echo "Context: $CTX | namespace: $NS | images: $REGISTRY/*:$TAG"

bash "$HERE/setup.sh"

PULL_ARGS=()
if [ -n "${REGISTRY_USER:-}" ]; then
  # kubectl has no stdin flag for --docker-password; keep the credentials in a
  # private file under the 700 STATE_DIR and hand kubectl only its path.
  REGISTRY_PASSWORD=${REGISTRY_PASSWORD:?set REGISTRY_PASSWORD}
  dockercfg=$(mktemp "$STATE_DIR/dockerconfigjson.XXXXXX")
  trap 'rm -f "$dockercfg"' EXIT
  # Credentials reach node only through its inherited environment; the eval
  # source names the variables and JSON.stringify escapes every control
  # character, so the file handed to --from-file stays valid JSON.
  REGISTRY_HOST=${REGISTRY%%/*} node --eval '
    const e = process.env;
    process.stdout.write(JSON.stringify({ auths: { [e.REGISTRY_HOST]: {
      username: e.REGISTRY_USER,
      password: e.REGISTRY_PASSWORD,
      auth: Buffer.from(e.REGISTRY_USER + ":" + e.REGISTRY_PASSWORD).toString("base64"),
    } } }) + "\n");
  ' >"$dockercfg"
  kubectl -n "$NS" create secret generic regcred \
    --type=kubernetes.io/dockerconfigjson \
    --from-file=".dockerconfigjson=$dockercfg" \
    --dry-run=client -o yaml | kubectl apply -f -
  rm -f "$dockercfg"
  trap - EXIT
  PULL_ARGS=(--set images.pullSecret=regcred)
fi

helm upgrade --install weeklyreport "$REPO/deploy/helm/weeklyreport" -n "$NS" \
  -f "$HERE/values-tester.yaml" \
  --set "images.registry=$REGISTRY" --set "images.tag=$TAG" "${PULL_ARGS[@]+"${PULL_ARGS[@]}"}" \
  --set "api.env.FRONTEND_URL=http://localhost:$APP_PORT" \
  --set "api.env.APP_BASE_URL=http://localhost:$APP_PORT" \
  --set "api.env.KEYCLOAK_SAML_CALLBACK_URL=http://localhost:$APP_PORT/auth/saml/callback" \
  --set "api.env.KEYCLOAK_SAML_ENTRY_POINT=http://localhost:$KC_PORT/realms/weeklyreport/protocol/saml" \
  --set-string "api.env.KEYCLOAK_SAML_CERT=$(cat "$STATE_DIR/idp-cert.b64")" \
  --wait --timeout 10m

pf_start app edge "$APP_PORT" 8080
pf_start keycloak keycloak "$KC_PORT" 8080
pf_start mailpit mailpit "$MAIL_PORT" 8025

# First start: the schema is migrated by the api pod, demo data and roles are
# loaded here. A failed count is not an empty table — refuse instead of
# resetting a stand that is not proven empty.
if ! user_count=$(kubectl -n "$NS" exec statefulset/postgres -- psql -U customreport \
  -d customreport_e2e -Atc 'SELECT count(*) FROM "User"'); then
  echo "Could not count users (psql error above); refusing to reset." >&2
  exit 1
fi
case "$user_count" in
  ''|*[!0-9]*)
    echo "Invalid user count; refusing to reset." >&2
    exit 1
    ;;
esac
if [ "$user_count" = 0 ]; then
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

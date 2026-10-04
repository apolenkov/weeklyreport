#!/usr/bin/env bash
# LOCAL STAND-IN bootstrap (OrbStack/any dev cluster). Generates every secret
# into $STATE_DIR (outside Git), creates the namespace and the two Secrets, and
# deploys Keycloak + Mailpit. Re-running reuses existing files.
#   STATE_DIR=... deploy/local-prod/setup.sh
set -euo pipefail
NS=${NS:-wr-local-prod}
APP_ORIGIN=${APP_ORIGIN:-http://localhost:8080}
STATE_DIR=${STATE_DIR:?set STATE_DIR to a directory outside Git}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$STATE_DIR"; chmod 700 "$STATE_DIR"; cd "$STATE_DIR"
rnd() { openssl rand -hex "$1"; }
[ -f idp.key ] || openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj /CN=weeklyreport -keyout idp.key -out idp.crt 2>/dev/null
if [ ! -f secrets.env ]; then
  umask 077
  cat > secrets.env <<ENV
DB_PASSWORD=$(rnd 16)
AUTH_JWT_SECRET=$(rnd 32)
PDF_EXPORT_JWT_SECRET=$(rnd 32)
AI_PROVIDER_CONFIG_ENCRYPTION_KEY=$(rnd 32)
KC_ADMIN_PASSWORD=$(rnd 12)
PW_LEAD1=Wr-lead1-$(rnd 4)
PW_HEAD=Wr-head-$(rnd 4)
PW_VIEWER=Wr-viewer-$(rnd 4)
PW_ADMIN=Wr-admin-$(rnd 4)
ENV
fi
set -a; . ./secrets.env; set +a
export APP_ORIGIN
export IDP_CERT_B64=$(openssl x509 -in idp.crt -outform der | base64 | tr -d '\n')
export IDP_KEY_B64=$(openssl pkcs8 -topk8 -nocrypt -in idp.key -outform der | base64 | tr -d '\n')
envsubst < "$HERE/realm.template.json" > realm.json
printf '%s' "$IDP_CERT_B64" > idp-cert.b64   # value for api.env.KEYCLOAK_SAML_CERT

kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" create secret generic weeklyreport-secrets \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" --from-literal=AUTH_JWT_SECRET="$AUTH_JWT_SECRET" \
  --from-literal=PDF_EXPORT_JWT_SECRET="$PDF_EXPORT_JWT_SECRET" \
  --from-literal=AI_PROVIDER_CONFIG_ENCRYPTION_KEY="$AI_PROVIDER_CONFIG_ENCRYPTION_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" create secret generic keycloak-realm \
  --from-file=realm.json --from-literal=ADMIN_PASSWORD="$KC_ADMIN_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" apply -f "$HERE/keycloak.yaml" -f "$HERE/mailpit.yaml"
kubectl -n "$NS" rollout status deploy/keycloak deploy/mailpit --timeout=300s
echo "IdP cert: $STATE_DIR/idp-cert.b64 ; passwords: $STATE_DIR/secrets.env"

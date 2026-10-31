#!/usr/bin/env bash
# TESTER KIT bootstrap (OrbStack or Docker Desktop with Kubernetes).
# Generates secrets and the IdP key into $STATE_DIR (outside Git), creates the namespace,
# the two Secrets, Keycloak and Mailpit. Called by start.sh; re-running reuses secrets.

set -euo pipefail

. "$(dirname "$0")/env.sh"
APP_ORIGIN=${APP_ORIGIN:-http://localhost:$APP_PORT}
KC_ORIGIN=${KC_ORIGIN:-http://localhost:$KC_PORT}

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
cd "$STATE_DIR"

rnd() { openssl rand -hex "$1"; }
# Stops the run with a non-zero exit before any kubectl call. Secret values are never printed.
fail() { echo "ERROR: $*" >&2; exit 1; }

# Generate secrets and certificates if not present. openssl errors stay on stderr.
# Files are written under temporary names and renamed only on success, so a failed run
# never leaves a half-written key pair or secrets.env behind.
if [ ! -f idp.key ] || [ ! -f idp.crt ]; then
  echo "Generating SAML IdP certificate..."
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj /CN=weeklyreport -keyout idp.key.tmp -out idp.crt.tmp \
    || { rm -f idp.key.tmp idp.crt.tmp; fail "could not generate the SAML IdP certificate"; }
  mv -f idp.key.tmp idp.key
  mv -f idp.crt.tmp idp.crt
fi

if [ ! -f secrets.env ]; then
  echo "Generating secrets..."
  umask 077
  # Every value is computed before the file is written; a failed rand call stops here.
  DB_PASSWORD=$(rnd 16) || fail "could not generate DB_PASSWORD"
  AUTH_JWT_SECRET=$(rnd 32) || fail "could not generate AUTH_JWT_SECRET"
  PDF_EXPORT_JWT_SECRET=$(rnd 32) || fail "could not generate PDF_EXPORT_JWT_SECRET"
  AI_PROVIDER_CONFIG_ENCRYPTION_KEY=$(rnd 32) || fail "could not generate AI_PROVIDER_CONFIG_ENCRYPTION_KEY"
  KC_ADMIN_PASSWORD=$(rnd 12) || fail "could not generate KC_ADMIN_PASSWORD"
  PW_LEAD1="Wr-lead1-$(rnd 4)" || fail "could not generate PW_LEAD1"
  PW_HEAD="Wr-head-$(rnd 4)" || fail "could not generate PW_HEAD"
  PW_VIEWER="Wr-viewer-$(rnd 4)" || fail "could not generate PW_VIEWER"
  PW_ADMIN="Wr-admin-$(rnd 4)" || fail "could not generate PW_ADMIN"
  cat > secrets.env.tmp <<ENV
DB_PASSWORD=$DB_PASSWORD
AUTH_JWT_SECRET=$AUTH_JWT_SECRET
PDF_EXPORT_JWT_SECRET=$PDF_EXPORT_JWT_SECRET
AI_PROVIDER_CONFIG_ENCRYPTION_KEY=$AI_PROVIDER_CONFIG_ENCRYPTION_KEY
KC_ADMIN_PASSWORD=$KC_ADMIN_PASSWORD
PW_LEAD1=$PW_LEAD1
PW_HEAD=$PW_HEAD
PW_VIEWER=$PW_VIEWER
PW_ADMIN=$PW_ADMIN
ENV
  mv -f secrets.env.tmp secrets.env
  echo "✓ Secrets created at $STATE_DIR/secrets.env"
fi

set -a
source ./secrets.env
set +a
for required_secret in DB_PASSWORD AUTH_JWT_SECRET PDF_EXPORT_JWT_SECRET AI_PROVIDER_CONFIG_ENCRYPTION_KEY KC_ADMIN_PASSWORD PW_LEAD1 PW_HEAD PW_VIEWER PW_ADMIN; do
  [ -n "${!required_secret:-}" ] || { echo "Missing required secret: $required_secret" >&2; exit 1; }
done
export APP_ORIGIN KC_ORIGIN

# Generate IDP cert for Kubernetes Secret
IDP_CERT_B64=$(openssl x509 -in idp.crt -outform der | base64 | tr -d '\n') || fail "could not encode the IdP certificate"
IDP_KEY_B64=$(openssl pkcs8 -topk8 -nocrypt -in idp.key -outform der | base64 | tr -d '\n') || fail "could not encode the IdP key"
export IDP_CERT_B64 IDP_KEY_B64
envsubst < "$HERE/realm.template.json" > realm.json
printf '%s' "$IDP_CERT_B64" > idp-cert.b64
# Login theme with role buttons; the passwords come from secrets.env, outside Git.
envsubst '${PW_LEAD1} ${PW_HEAD} ${PW_VIEWER} ${PW_ADMIN}' < "$HERE/keycloak-theme/roles.js.tpl" > roles.js

# Create namespace
echo "Creating namespace $NS..."
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

# Create secrets
echo "Creating Kubernetes secrets..."
kubectl -n "$NS" create secret generic weeklyreport-secrets \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=AUTH_JWT_SECRET="$AUTH_JWT_SECRET" \
  --from-literal=PDF_EXPORT_JWT_SECRET="$PDF_EXPORT_JWT_SECRET" \
  --from-literal=AI_PROVIDER_CONFIG_ENCRYPTION_KEY="$AI_PROVIDER_CONFIG_ENCRYPTION_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NS" create secret generic keycloak-realm \
  --from-file=realm.json \
  --from-literal=ADMIN_PASSWORD="$KC_ADMIN_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NS" create configmap keycloak-theme \
  --from-file=theme.properties="$HERE/keycloak-theme/theme.properties" \
  --from-file=roles.js \
  --from-file=roles.css="$HERE/keycloak-theme/roles.css" \
  --dry-run=client -o yaml | kubectl apply -f -

# Deploy Keycloak and Mailpit
echo "Deploying Keycloak and Mailpit..."
envsubst '$KC_ORIGIN' < "$HERE/keycloak.yaml" | kubectl -n "$NS" apply -f -
kubectl -n "$NS" apply -f "$HERE/mailpit.yaml"

# Wait for deployments
echo "Waiting for deployments..."
kubectl -n "$NS" rollout status deploy/keycloak deploy/mailpit --timeout=300s
echo "✓ Infrastructure ready"

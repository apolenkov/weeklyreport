#!/usr/bin/env bash
# TESTER KIT bootstrap (OrbStack or Docker Desktop with Kubernetes).
# Generates secrets, creates namespace, Keycloak + Mailpit, and runs migrations.
# Re-running reuses existing secrets.
#   STATE_DIR=... deploy/tester-kit/setup.sh

set -euo pipefail
trap 'echo "Error on line $LINENO"' ERR

NS=${NS:-wr-tester}
APP_ORIGIN=${APP_ORIGIN:-http://localhost:8080}
STATE_DIR=${STATE_DIR:?set STATE_DIR to a directory outside Git}
HERE=$(cd "$(dirname "$0")" && pwd)

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found. Install Docker Desktop/OrbStack with Kubernetes enabled."; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "helm not found. Install Helm 3."; exit 1; }

# Check cluster connectivity
kubectl cluster-info >/dev/null 2>&1 || { echo "Cannot connect to cluster. Check kubectl context."; exit 1; }
echo "✓ Cluster: $(kubectl config current-context)"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
cd "$STATE_DIR"

rnd() { openssl rand -hex "$1"; }

# Generate secrets and certificates if not present
[ -f idp.key ] || {
  echo "Generating SAML IdP certificate..."
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj /CN=weeklyreport -keyout idp.key -out idp.crt 2>/dev/null
}

if [ ! -f secrets.env ]; then
  echo "Generating secrets..."
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
  echo "✓ Secrets created at $STATE_DIR/secrets.env"
fi

set -a
source ./secrets.env
set +a
export APP_ORIGIN

# Generate IDP cert for Kubernetes Secret
export IDP_CERT_B64=$(openssl x509 -in idp.crt -outform der | base64 | tr -d '\n')
export IDP_KEY_B64=$(openssl pkcs8 -topk8 -nocrypt -in idp.key -outform der | base64 | tr -d '\n')
envsubst < "$HERE/realm.template.json" > realm.json
printf '%s' "$IDP_CERT_B64" > idp-cert.b64

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

# Deploy Keycloak and Mailpit
echo "Deploying Keycloak and Mailpit..."
kubectl -n "$NS" apply -f "$HERE/keycloak.yaml" -f "$HERE/mailpit.yaml"

# Wait for deployments
echo "Waiting for deployments..."
kubectl -n "$NS" rollout status deploy/keycloak deploy/mailpit --timeout=300s
echo "✓ Infrastructure ready"

echo ""
echo "=== Setup Complete ==="
echo "Namespace: $NS"
echo "State dir: $STATE_DIR"
echo "Secrets at: $STATE_DIR/secrets.env"
echo "IdP cert: $STATE_DIR/idp-cert.b64"
echo ""
echo "Users:"
echo "  Lead (reports): lead1@customreport.local / PW_LEAD1"
echo "  Head (publish): head@customreport.local / PW_HEAD"
echo "  Viewer: viewer@customreport.local / PW_VIEWER"
echo "  Admin: admin@customreport.local / PW_ADMIN"
echo ""
echo "Next: run ./start.sh"

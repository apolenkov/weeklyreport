#!/usr/bin/env bash
# Start the tester kit: setup infrastructure, install Helm chart, wait for health.
#   start.sh [--tag <git-sha>] [--registry <host>]
#   start.sh [--local]  # Use local wr/* images

set -euo pipefail
trap 'echo "Error on line $LINENO"' ERR

NS=${NS:-wr-tester}
STATE_DIR=${STATE_DIR:?set STATE_DIR to a directory outside Git}
HERE=$(cd "$(dirname "$0")" && pwd)

# Parse arguments
TAG=""
REGISTRY="registry.gitlab.example.org:5005/acme/weeklyreport"
USE_LOCAL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --local)
      USE_LOCAL=true
      shift
      ;;
    *)
      echo "Usage: $0 [--tag <sha>] [--registry <host>] [--local]"
      exit 1
      ;;
  esac
done

# If no tag specified, use main HEAD from git
if [ -z "$TAG" ]; then
  if command -v git >/dev/null 2>&1 && [ -d "$(git rev-parse --git-dir 2>/dev/null)" ]; then
    TAG=$(git rev-parse HEAD)
    echo "Using git HEAD: $TAG"
  else
    echo "Error: --tag <git-sha> required (git not available or not a repo)"
    exit 1
  fi
fi

# Use local images if requested or if registry images not available
if [ "$USE_LOCAL" = true ]; then
  REGISTRY="wr"
  echo "Using local wr/* images"
fi

echo "Registry: $REGISTRY"
echo "Tag: $TAG"
echo "Namespace: $NS"

# Run setup if not done
if ! kubectl get namespace "$NS" >/dev/null 2>&1; then
  echo "Running setup.sh..."
  bash "$HERE/setup.sh"
else
  echo "✓ Namespace $NS already exists"
fi

# Source secrets for IDP cert
set -a
source "$STATE_DIR/secrets.env"
set +a
IDP_CERT_B64=$(cat "$STATE_DIR/idp-cert.b64")

# Install Helm chart
echo "Installing WeeklyReport Helm chart..."
CHART_DIR="$HERE/../helm/weeklyreport"
helm upgrade --install weeklyreport "$CHART_DIR" \
  --namespace "$NS" \
  --values "$HERE/values-tester.yaml" \
  --set "images.registry=$REGISTRY" \
  --set "images.tag=$TAG" \
  --set-string "api.env.KEYCLOAK_SAML_CERT=$IDP_CERT_B64" \
  --wait \
  --timeout 10m

echo "✓ Helm chart installed"

# Wait for API health check
echo "Waiting for /health/ready..."
for i in {1..120}; do
  if kubectl -n "$NS" get pod -l app=api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null | grep -q .; then
    POD=$(kubectl -n "$NS" get pod -l app=api -o jsonpath='{.items[0].metadata.name}')
    if kubectl -n "$NS" exec "$POD" -- curl -f http://localhost:3001/health/ready >/dev/null 2>&1; then
      echo "✓ API is ready"
      break
    fi
  fi
  echo "Waiting... ($i/120)"
  sleep 2
done

# Get access info
echo ""
echo "=== Setup Complete ==="
echo "Namespace: $NS"
echo "App URL: http://localhost:8080"
echo "Keycloak: http://localhost:8081 (admin/$(grep KC_ADMIN_PASSWORD $STATE_DIR/secrets.env | cut -d= -f2))"
echo "Mailpit: http://localhost:1025 (SMTP) / http://localhost:8025 (Web)"
echo ""
echo "Test Users:"
grep "^PW_" "$STATE_DIR/secrets.env" | while read line; do
  var=$(echo "$line" | cut -d= -f1)
  val=$(echo "$line" | cut -d= -f2)
  case "$var" in
    PW_LEAD1) echo "  lead1@customreport.local / $val" ;;
    PW_HEAD) echo "  head@customreport.local / $val" ;;
    PW_VIEWER) echo "  viewer@customreport.local / $val" ;;
    PW_ADMIN) echo "  admin@customreport.local / $val" ;;
  esac
done
echo ""
echo "To reset demo data: ./reset.sh"
echo "To stop: ./stop.sh"

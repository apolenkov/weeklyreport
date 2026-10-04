#!/usr/bin/env bash
# Delete the tester stand (namespace wr-tester with its data) and stop port-forwards.
#   stop.sh [--yes]
set -euo pipefail
. "$(dirname "$0")/env.sh"

if kubectl get namespace "$NS" >/dev/null 2>&1; then
  if [ "${1:-}" != --yes ]; then
    read -r -p "Delete namespace $NS with all data? (yes/no): " ans
    [ "$ans" = yes ] || { echo Cancelled; exit 0; }
  fi
  kubectl delete namespace "$NS" --wait=true
fi
for n in app keycloak mailpit; do pf_stop "$n"; done
echo "Stopped. Secrets stay in $STATE_DIR."

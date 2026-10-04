#!/usr/bin/env bash
# Stop and delete the tester kit namespace and all resources.

set -euo pipefail

NS=${NS:-wr-tester}

if ! kubectl get namespace "$NS" >/dev/null 2>&1; then
  echo "Namespace $NS not found"
  exit 0
fi

read -p "Delete namespace $NS and all resources? (yes/no): " -r confirm
if [ "$confirm" != "yes" ]; then
  echo "Cancelled"
  exit 0
fi

echo "Deleting namespace $NS..."
kubectl delete namespace "$NS" --wait=true

echo "✓ Namespace deleted"

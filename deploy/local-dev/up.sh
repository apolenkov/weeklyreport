#!/usr/bin/env bash
# Start the local development dependencies in the wr-dev namespace.
set -euo pipefail
cd "$(dirname "$0")"
. ./context.sh

local_dev_kubectl create namespace wr-dev --dry-run=client -o yaml | local_dev_kubectl apply -f -
local_dev_kubectl -n wr-dev create configmap pg-init \
  --from-file=init-pg-stat-statements.sql=../postgres/init-pg-stat-statements.sql \
  --dry-run=client -o yaml | local_dev_kubectl apply -f -
local_dev_kubectl -n wr-dev apply -f deps.yaml
local_dev_kubectl -n wr-dev rollout status statefulset/postgres statefulset/redis \
  deployment/mailpit deployment/gotenberg --timeout=300s

#!/usr/bin/env bash
# Stop the dependencies; PVCs (Postgres/Redis data) survive. Wipe everything
# with `kubectl --context=orbstack delete namespace wr-dev`.
set -euo pipefail
cd "$(dirname "$0")"
. ./context.sh

local_dev_kubectl -n wr-dev delete -f deps.yaml --ignore-not-found

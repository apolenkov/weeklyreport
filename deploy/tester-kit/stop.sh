#!/usr/bin/env bash
# Delete the tester stand (namespace wr-tester with its data) and stop port-forwards.
#   stop.sh [--yes]
set -euo pipefail
. "$(dirname "$0")/env.sh"
. "$HERE/guard.sh"
tester_target_guard

result=0
if tester_kubectl get namespace "$NS" >/dev/null 2>&1; then
  if [ "${1:-}" != --yes ]; then
    read -r -p "Delete namespace $NS with all data? (yes/no): " ans
    [ "$ans" = yes ] || { echo Cancelled; exit 0; }
  fi
  tester_kubectl delete namespace "$NS" --wait=true --timeout=120s || result=$?
fi
for n in app keycloak mailpit; do
  if pf_stop "$n"; then
    :
  else
    cleanup_result=$?
    echo "Could not stop $n port-forward (exit $cleanup_result)." >&2
    [ "$result" -ne 0 ] || result=$cleanup_result
  fi
done
[ "$result" -eq 0 ] || exit "$result"
echo "Stopped. Secrets stay in $STATE_DIR."
